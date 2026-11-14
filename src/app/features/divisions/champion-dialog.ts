import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { Api } from '../../core/api';
import { CardDivision } from '../../core/models';
import { Refs } from '../../core/refs';

export interface ChampionDialogData {
    division: CardDivision;
}

type Mode = 'fix' | 'change';

/** Define o campeão do título vinculado à divisão (corrigir o atual ou registrar uma troca). */
@Component({
    selector: 'app-champion-dialog',
    imports: [FormsModule, ButtonModule, MultiSelectModule, SelectModule, SelectButtonModule],
    template: `
        <p class="text-muted-color mt-0">
            Título: <strong>{{ division.title?.['name'] }}</strong>
            @if (current()) {
                · campeão atual: <strong>{{ current() }}</strong>
            }
        </p>
        <div class="flex flex-col gap-4">
            <div>
                <label class="block font-medium mb-2">O que você quer fazer?</label>
                <p-selectbutton [options]="modes" optionLabel="label" optionValue="value" [(ngModel)]="mode" [allowEmpty]="false" />
                <small class="text-muted-color block mt-2">
                    @if (mode() === 'fix') {
                        Corrige quem é o campeão atual, mantendo o reinado em andamento (use para ajustar o universe ao seu).
                    } @else {
                        Registra uma troca de título: encerra o reinado atual e abre outro. O ex-campeão volta para o meio da fila.
                    }
                </small>
            </div>

            @if (isTag) {
                <div>
                    <label class="block font-medium mb-2">Dupla campeã</label>
                    <p-select [options]="teamOptions()" optionLabel="label" optionValue="value" [filter]="true" filterBy="label" [showClear]="true" placeholder="Escolha a dupla" appendTo="body" [ngModel]="teamId()" (ngModelChange)="pickTeam($event)" fluid />
                </div>
                <div>
                    <label class="block font-medium mb-2">ou 2 lutadores</label>
                    <p-multiselect [options]="wrestlerOptions()" optionLabel="label" optionValue="value" [filter]="true" filterBy="label" display="chip" [selectionLimit]="2" placeholder="Escolha 2 lutadores" appendTo="body" [ngModel]="wrestlerIds()" (ngModelChange)="pickWrestlers($event)" fluid />
                </div>
            } @else {
                <div>
                    <label class="block font-medium mb-2">Campeão</label>
                    <p-select [options]="wrestlerOptions()" optionLabel="label" optionValue="value" [filter]="true" filterBy="label" [showClear]="true" placeholder="Escolha o lutador" appendTo="body" [ngModel]="wrestlerIds()[0] ?? null" (ngModelChange)="pickWrestlers($event ? [$event] : [])" fluid />
                </div>
            }
            <small class="text-muted-color -mt-2">Deixe vazio para deixar o título vago.</small>

            <div class="flex justify-end gap-2 mt-2">
                <p-button type="button" label="Cancelar" severity="secondary" text (onClick)="ref.close()" />
                <p-button type="button" label="Salvar campeão" icon="pi pi-check" [loading]="busy()" [disabled]="!valid()" (onClick)="save()" />
            </div>
        </div>
    `
})
export class ChampionDialog {
    protected readonly ref = inject(DynamicDialogRef);
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);
    protected readonly division = (inject(DynamicDialogConfig).data as ChampionDialogData).division;
    protected readonly isTag = !!this.division.title?.['isTag'];
    protected readonly modes: { label: string; value: Mode }[] = [
        { label: 'Corrigir campeão atual', value: 'fix' },
        { label: 'Registrar troca de título', value: 'change' }
    ];
    protected readonly mode = signal<Mode>('fix');
    protected readonly busy = signal(false);
    protected readonly wrestlerIds = signal<string[]>(this.division.champions.filter((c) => c.wrestlerId).map((c) => c.wrestlerId!));
    protected readonly teamId = signal<string | null>(this.division.champions.find((c) => c.teamId)?.teamId ?? null);

    protected readonly current = computed(() => this.division.champions.map((c) => c.name).join(' & '));

    protected readonly wrestlerOptions = computed(() => {
        this.refs.version();
        const g = this.division.gender;
        return this.refs
            .list('wrestlers')
            .filter((w) => !g || !w['gender'] || w['gender'] === g)
            .map((w) => ({ value: w.id, label: w['name'] as string }))
            .sort((a, b) => a.label.localeCompare(b.label));
    });

    protected readonly teamOptions = computed(() => {
        this.refs.version();
        return this.refs
            .list('teams')
            .filter((t) => t['kind'] !== 'FACTION')
            .map((t) => ({ value: t.id, label: t['name'] as string }))
            .sort((a, b) => a.label.localeCompare(b.label));
    });

    protected valid(): boolean {
        if (!this.isTag) return this.wrestlerIds().length <= 1;
        return (this.teamId() ? 1 : 0) + this.wrestlerIds().length === 0 || !!this.teamId() || this.wrestlerIds().length === 2;
    }

    protected pickTeam(id: string | null) {
        this.teamId.set(id);
        if (id) this.wrestlerIds.set([]);
    }

    protected pickWrestlers(ids: string[]) {
        this.wrestlerIds.set(ids ?? []);
        if (ids?.length) this.teamId.set(null);
    }

    protected async save() {
        this.busy.set(true);
        const holders = this.teamId() ? [{ teamId: this.teamId() }] : this.wrestlerIds().map((wrestlerId) => ({ wrestlerId }));
        try {
            const updated = await this.api.put<CardDivision>(`card-divisions/${this.division.id}/champion`, { mode: this.mode(), holders });
            this.ref.close(updated);
        } catch {
            /* mensagem exibida pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
