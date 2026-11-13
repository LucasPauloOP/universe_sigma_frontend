import { Component, OnInit, inject, signal } from '@angular/core';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { Api } from '../../core/api';
import { fmtDate } from '../../core/format';
import { Entity } from '../../core/models';

interface Rec {
    matches: number;
    wins: number;
    losses: number;
    draws: number;
    titleReigns: number;
}

@Component({
    selector: 'app-wrestler-record',
    imports: [ProgressSpinnerModule],
    template: `
        @if (rec(); as r) {
            <div class="grid grid-cols-3 gap-3">
                @for (t of tiles(r); track t.label) {
                    <div class="flex flex-col items-center p-4 rounded-xl bg-surface-100 dark:bg-surface-800">
                        <span class="text-2xl font-semibold">{{ t.value }}</span>
                        <span class="text-sm text-muted-color">{{ t.label }}</span>
                    </div>
                }
            </div>
            <p class="text-sm text-muted-color mt-4 mb-0">Considera apenas lutas marcadas como realizadas.</p>
        } @else {
            <div class="flex justify-center p-6"><p-progress-spinner strokeWidth="4" [style]="{ width: '2.5rem', height: '2.5rem' }" /></div>
        }
    `
})
export class WrestlerRecord implements OnInit {
    protected readonly data = inject(DynamicDialogConfig).data as Entity;
    private readonly api = inject(Api);
    protected readonly rec = signal<Rec | null>(null);

    async ngOnInit() {
        this.rec.set(await this.api.get<Rec & Entity>(`wrestlers/${this.data.id}/record`).catch(() => null));
    }

    protected tiles(r: Rec) {
        return [
            { label: 'Lutas', value: r.matches },
            { label: 'Vitórias', value: r.wins },
            { label: 'Derrotas', value: r.losses },
            { label: 'Empates', value: r.draws },
            { label: 'Reinados', value: r.titleReigns },
            { label: 'Aproveitamento', value: r.matches ? `${Math.round((r.wins / r.matches) * 100)}%` : '—' }
        ];
    }
}

interface Reign extends Entity {
    days: number;
    defenses: number;
    startDate: string;
    endDate: string | null;
    holders: Entity[];
}

@Component({
    selector: 'app-title-history',
    imports: [ProgressSpinnerModule, TableModule],
    template: `
        @if (reigns(); as list) {
            @if (list.length) {
                <p-table [value]="list" [tableStyle]="{ 'min-width': '34rem' }">
                    <ng-template #header>
                        <tr>
                            <th>#</th>
                            <th>Campeão(ões)</th>
                            <th>Período</th>
                            <th>Dias</th>
                            <th>Defesas</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-r let-i="rowIndex">
                        <tr>
                            <td>{{ i + 1 }}</td>
                            <td>{{ holders(r) }}</td>
                            <td>{{ fmt(r.startDate) }} → {{ r.endDate ? fmt(r.endDate) : 'atual' }}</td>
                            <td>{{ r.days }}</td>
                            <td>{{ r.defenses }}</td>
                        </tr>
                    </ng-template>
                </p-table>
            } @else {
                <p class="text-muted-color">Nenhum reinado registrado para este título.</p>
            }
        } @else {
            <div class="flex justify-center p-6"><p-progress-spinner strokeWidth="4" [style]="{ width: '2.5rem', height: '2.5rem' }" /></div>
        }
    `
})
export class TitleHistory implements OnInit {
    protected readonly data = inject(DynamicDialogConfig).data as Entity;
    private readonly api = inject(Api);
    protected readonly reigns = signal<Reign[] | null>(null);
    protected readonly fmt = fmtDate;

    async ngOnInit() {
        const res = await this.api.get<{ reigns: Reign[] }>(`titles/${this.data.id}/history`).catch(() => null);
        this.reigns.set(res?.reigns ?? []);
    }

    protected holders(r: Reign) {
        return r.holders.map((h) => h['wrestler']?.name ?? h['team']?.name).join(' & ') || '—';
    }
}
