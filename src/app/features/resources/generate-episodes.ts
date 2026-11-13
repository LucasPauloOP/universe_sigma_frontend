import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { Api } from '../../core/api';
import { monthOptions } from '../../core/format';
import { Refs } from '../../core/refs';
import { RESOURCES } from '../../core/resources';

@Component({
    selector: 'app-generate-episodes',
    imports: [ReactiveFormsModule, ButtonModule, InputNumberModule, MultiSelectModule, SelectModule],
    template: `
        <p class="text-muted-color mt-0">Cria os episódios que faltam (sem duplicar os existentes): shows semanais por semana e PLEs no mês configurado.</p>
        <form [formGroup]="form" (ngSubmit)="run()" class="flex flex-col gap-4">
            <div>
                <label class="block font-medium mb-2">Temporada *</label>
                <p-select formControlName="seasonId" [options]="seasons()" optionLabel="label" optionValue="value" placeholder="Selecione" appendTo="body" fluid />
            </div>
            <div>
                <label class="block font-medium mb-2">Shows (vazio = todos)</label>
                <p-multiselect formControlName="showIds" [options]="shows()" optionLabel="label" optionValue="value" display="chip" placeholder="Todos" appendTo="body" fluid />
            </div>
            <div>
                <label class="block font-medium mb-2">Meses (vazio = do mês de início da temporada até abril)</label>
                <p-multiselect formControlName="months" [options]="months" optionLabel="label" optionValue="value" display="chip" placeholder="Ano todo" appendTo="body" fluid />
            </div>
            <div>
                <label class="block font-medium mb-2">Semanas por mês (shows semanais)</label>
                <p-inputnumber formControlName="weeks" [min]="1" [max]="4" [showButtons]="true" fluid />
            </div>
            <div class="flex justify-end gap-2 mt-2">
                <p-button type="button" label="Cancelar" severity="secondary" text (onClick)="ref.close()" />
                <p-button type="submit" label="Gerar" icon="pi pi-bolt" [loading]="busy()" [disabled]="form.invalid" />
            </div>
        </form>
    `
})
export class GenerateEpisodes {
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);
    protected readonly ref = inject(DynamicDialogRef);
    protected readonly months = monthOptions;
    protected readonly busy = signal(false);
    protected readonly form = inject(FormBuilder).group({
        seasonId: ['' as string, Validators.required],
        showIds: [[] as string[]],
        months: [[] as number[]],
        weeks: [4 as number, [Validators.required, Validators.min(1), Validators.max(4)]]
    });

    protected readonly seasons = computed(() => (this.refs.version(), this.refs.list('seasons').map((e) => ({ value: e.id, label: RESOURCES['seasons'].label(e) }))));
    protected readonly shows = computed(() => (this.refs.version(), this.refs.list('shows').map((e) => ({ value: e.id, label: e['name'] as string }))));

    constructor() {
        void this.refs.loadMany(['seasons', 'shows']);
    }

    protected async run() {
        if (this.form.invalid) return;
        this.busy.set(true);
        try {
            const { seasonId, showIds, months, weeks } = this.form.getRawValue();
            const res = await this.api.post<{ created: number }>('episodes/generate', {
                seasonId,
                weeks,
                ...(showIds?.length ? { showIds } : {}),
                ...(months?.length ? { months } : {})
            });
            this.ref.close(res.created);
        } catch {
            /* erro exibido pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
