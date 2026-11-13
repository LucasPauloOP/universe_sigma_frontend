import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SelectModule } from 'primeng/select';
import { Api } from '../../core/api';
import { Entrant, TournamentMatch } from '../../core/models';

export interface MatchDialogData {
    match: TournamentMatch;
    entrants: Entrant[];
}

export const entrantName = (e: Entrant | null | undefined): string => (e ? (e.wrestler?.name ?? e.team?.['name'] ?? '?') : '');

@Component({
    selector: 'app-match-dialog',
    imports: [ReactiveFormsModule, ButtonModule, SelectModule],
    template: `
        <p class="text-muted-color mt-0">{{ data.match.groupName ? data.match.groupName + ' · ' : '' }}Rodada {{ data.match.round }} · Luta {{ data.match.slot }}</p>
        <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-4">
            @for (side of sides; track side.key) {
                <div>
                    <label class="block font-medium mb-2">{{ side.label }}</label>
                    <p-select [formControlName]="side.key" [options]="all()" optionLabel="label" optionValue="value" [showClear]="true" placeholder="— a definir —" appendTo="body" fluid />
                </div>
            }
            <div>
                <label class="block font-medium mb-2">Vencedor</label>
                <p-select formControlName="winnerId" [options]="contenders()" optionLabel="label" optionValue="value" [showClear]="true" placeholder="— ainda sem resultado —" appendTo="body" fluid />
            </div>
            @if (form.errors?.['same']) {
                <small class="text-red-500">Os dois lados não podem ser o mesmo participante.</small>
            }
            @if (data.match.segment; as seg) {
                <p class="text-muted-color m-0">Vinculada ao segmento de {{ seg.episode?.show?.['name'] ?? 'um episódio' }}.</p>
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
    protected readonly busy = signal(false);
    protected readonly sides = [
        { key: 'entrantAId', label: 'Lado A' },
        { key: 'entrantBId', label: 'Lado B' }
    ] as const;
    protected readonly form = new FormGroup({
        entrantAId: new FormControl<string | null>(this.data.match.entrantAId),
        entrantBId: new FormControl<string | null>(this.data.match.entrantBId),
        winnerId: new FormControl<string | null>(this.data.match.winnerId)
    });

    protected all() {
        return this.data.entrants.map((e) => ({ value: e.id, label: entrantName(e) + (e.seed ? ` (#${e.seed})` : '') }));
    }

    /** Só A ou B podem vencer. */
    protected contenders() {
        const { entrantAId, entrantBId } = this.form.getRawValue();
        return this.all().filter((o) => o.value === entrantAId || o.value === entrantBId);
    }

    protected async save() {
        const v = this.form.getRawValue();
        if (v.entrantAId && v.entrantAId === v.entrantBId) {
            this.form.setErrors({ same: true });
            return;
        }
        // vencedor que deixou de ser um dos lados é descartado
        const winnerId = v.winnerId === v.entrantAId || v.winnerId === v.entrantBId ? v.winnerId : null;
        this.busy.set(true);
        try {
            this.ref.close(await this.api.put(`tournament-matches/${this.data.match.id}`, { ...v, winnerId }));
        } catch {
            /* erro exibido pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
