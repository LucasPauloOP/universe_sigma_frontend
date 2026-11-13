import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { Api } from '../../core/api';
import { Entrant, TournamentMatch } from '../../core/models';
import { Refs } from '../../core/refs';

export interface MatchDialogData {
    match: TournamentMatch;
    entrants: Entrant[];
}

export const entrantName = (e: Entrant | null | undefined): string => (e ? (e.wrestler?.name ?? e.team?.['name'] ?? '?') : '');

/** Competidores da luta na ordem: A, B e os adicionais. */
export const competitorsOf = (m: TournamentMatch): Entrant[] => [m.entrantA, m.entrantB, ...(m.extras ?? []).map((x) => x.entrant)].filter((e): e is Entrant => !!e);

@Component({
    selector: 'app-match-dialog',
    imports: [ReactiveFormsModule, ButtonModule, MultiSelectModule, SelectModule],
    template: `
        <p class="text-muted-color mt-0">{{ data.match.groupName ? data.match.groupName + ' · ' : '' }}Rodada {{ data.match.round }} · Luta {{ data.match.slot }}</p>
        <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-4">
            <div>
                <label class="block font-medium mb-2">Tipo de luta / estipulação</label>
                <p-select formControlName="matchTypeId" [options]="matchTypes()" optionLabel="label" optionValue="value" [filter]="true" filterBy="label" [showClear]="true" placeholder="Automático (pelo nº de competidores)" appendTo="body" fluid />
                <small class="block mt-1 text-muted-color">Cada luta pode ter o seu: Singles, Triple Threat, Hell in a Cell...</small>
            </div>
            <div>
                <label class="block font-medium mb-2">Competidores</label>
                <p-multiselect formControlName="competitors" [options]="all()" optionLabel="label" optionValue="value" display="chip" [filter]="true" filterBy="label" placeholder="Escolha os competidores" appendTo="body" [maxSelectedLabels]="10" fluid />
                <small class="block mt-1 text-muted-color">Dois = luta comum; três ou mais = triple threat, fatal 4-way... Só um vence e avança na chave.</small>
            </div>
            <div>
                <label class="block font-medium mb-2">Vencedor</label>
                <p-select formControlName="winnerId" [options]="contenders()" optionLabel="label" optionValue="value" [showClear]="true" placeholder="— ainda sem resultado —" appendTo="body" fluid />
            </div>
            @if (data.match.segment; as seg) {
                <p class="text-muted-color m-0">Luta agendada no card de um episódio: os lutadores e o tipo de luta daqui são aplicados lá enquanto ela não for realizada.</p>
            }
            <div class="flex justify-end gap-2 mt-2">
                <p-button type="button" label="Cancelar" severity="secondary" text (onClick)="ref.close()" />
                <p-button type="submit" label="Salvar" icon="pi pi-check" [loading]="busy()" />
            </div>
        </form>
    `
})
export class MatchDialog {
    protected readonly ref = inject(DynamicDialogRef);
    protected readonly data = inject(DynamicDialogConfig).data as MatchDialogData;
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);
    protected readonly busy = signal(false);

    protected readonly form = new FormGroup({
        matchTypeId: new FormControl<string | null>(this.data.match.matchTypeId),
        competitors: new FormControl<string[]>(competitorsOf(this.data.match).map((e) => e.id), { nonNullable: true }),
        winnerId: new FormControl<string | null>(this.data.match.winnerId)
    });
    private readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), { initialValue: this.form.value });

    protected readonly matchTypes = computed(() => (this.refs.version(), this.refs.list('match-types').map((e) => ({ value: e.id, label: e['name'] as string }))));

    constructor() {
        void this.refs.load('match-types');
    }

    protected all() {
        return this.data.entrants.map((e) => ({ value: e.id, label: entrantName(e) + (e.seed ? ` (#${e.seed})` : '') }));
    }

    /** Só quem está na luta pode vencer. */
    protected contenders() {
        const ids = new Set(this.values().competitors ?? []);
        return this.all().filter((o) => ids.has(o.value));
    }

    protected async save() {
        const v = this.form.getRawValue();
        const ids = v.competitors;
        // vencedor que deixou de ser competidor é descartado
        const winnerId = v.winnerId && ids.includes(v.winnerId) ? v.winnerId : null;
        this.busy.set(true);
        try {
            this.ref.close(
                await this.api.put(`tournament-matches/${this.data.match.id}`, {
                    entrantAId: ids[0] ?? null,
                    entrantBId: ids[1] ?? null,
                    extraEntrantIds: ids.slice(2),
                    matchTypeId: v.matchTypeId,
                    winnerId
                })
            );
        } catch {
            /* erro exibido pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
