import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { Api } from '../../core/api';
import { beforeStart, compareEpisodes, episodeText } from '../../core/format';
import { Entity } from '../../core/models';
import { Refs } from '../../core/refs';
import { RESOURCES } from '../../core/resources';

export interface ScheduleData {
    /** texto de apoio: "Quartas de final (4 lutas)" ou "Quartas de final · Luta 2" */
    summary: string;
    /** mostra o tipo de luta (só ao agendar UMA luta) */
    askMatchType: boolean;
    /** tipo de luta já definido na luta do torneio (vem preenchido) */
    matchTypeId?: string | null;
}

export interface ScheduleResult {
    episodeId: string;
    matchTypeId: string | null;
}

/** Escolhe o episódio em que a(s) luta(s) do torneio acontecem. */
@Component({
    selector: 'app-schedule-dialog',
    imports: [FormsModule, ButtonModule, ProgressSpinnerModule, SelectModule],
    template: `
        <p class="text-muted-color mt-0">{{ data.summary }}</p>
        @if (loading()) {
            <div class="flex justify-center p-6"><p-progress-spinner strokeWidth="4" [style]="{ width: '2.5rem', height: '2.5rem' }" /></div>
        } @else {
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block font-medium mb-2">Episódio *</label>
                    <p-select [options]="episodes()" optionLabel="label" optionValue="value" optionGroupLabel="label" optionGroupChildren="items" [group]="true" [filter]="true" filterBy="label" placeholder="Escolha o episódio" appendTo="body" [(ngModel)]="episodeId" fluid />
                    @if (!episodes().length) {
                        <small class="text-muted-color">Nenhum episódio planejado. Gere o calendário em Episódios.</small>
                    }
                </div>
                @if (data.askMatchType) {
                    <div>
                        <label class="block font-medium mb-2">Tipo de luta</label>
                        <p-select [options]="matchTypes()" optionLabel="label" optionValue="value" [showClear]="true" placeholder="Automático (pelo nº de competidores)" appendTo="body" [(ngModel)]="matchTypeId" fluid />
                    </div>
                }
                <div class="flex justify-end gap-2 mt-2">
                    <p-button type="button" label="Cancelar" severity="secondary" text (onClick)="ref.close()" />
                    <p-button type="button" label="Agendar" icon="pi pi-calendar-plus" [disabled]="!episodeId" (onClick)="confirm()" />
                </div>
            </div>
        }
    `
})
export class ScheduleDialog {
    protected readonly ref = inject(DynamicDialogRef);
    protected readonly data = inject(DynamicDialogConfig).data as ScheduleData;
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);

    protected readonly loading = signal(true);
    private readonly items = signal<Entity[]>([]);
    private readonly seasons = signal<Entity[]>([]);
    protected episodeId: string | null = null;
    protected matchTypeId: string | null = this.data.matchTypeId ?? null;

    /** Episódios planejados, agrupados por temporada, na ordem de jogo. */
    protected readonly episodes = computed(() => {
        const bySeason = new Map<string, Entity[]>();
        for (const e of this.items()) bySeason.set(e['seasonId'], [...(bySeason.get(e['seasonId']) ?? []), e]);
        return [...bySeason.entries()]
            .map(([sid, list]) => {
                const season = this.seasons().find((s) => s.id === sid);
                return {
                    n: season?.['number'] ?? 0,
                    label: season ? RESOURCES['seasons'].label(season) : 'Temporada',
                    items: list
                        .filter((e) => !beforeStart(e['month'], season?.['startMonth']))
                        .sort((a, b) => compareEpisodes(a as never, b as never))
                        .map((e) => ({ value: e.id, label: episodeText(e as never) }))
                };
            })
            .filter((g) => g.items.length)
            .sort((a, b) => a.n - b.n);
    });

    protected readonly matchTypes = computed(() => (this.refs.version(), this.refs.list('match-types').map((e) => ({ value: e.id, label: e['name'] as string }))));

    constructor() {
        void this.load();
    }

    private async load() {
        try {
            const [episodes, seasons] = await Promise.all([this.api.all('episodes', { status: 'PLANNED' }), this.api.all('seasons'), this.refs.load('match-types')]);
            this.items.set(episodes);
            this.seasons.set(seasons);
        } finally {
            this.loading.set(false);
        }
    }

    protected confirm() {
        if (this.episodeId) this.ref.close({ episodeId: this.episodeId, matchTypeId: this.matchTypeId } satisfies ScheduleResult);
    }
}
