import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { Api } from '../../core/api';
import { CardDivision, DivisionEntry } from '../../core/models';

/** Ranking das divisões (somente leitura) para apoiar o planejamento do episódio. */
@Component({
    selector: 'app-division-ranking',
    imports: [FormsModule, ProgressSpinnerModule, SelectModule],
    template: `
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
            @if (!board()) {
                <div class="flex justify-center p-4"><p-progress-spinner strokeWidth="4" [style]="{ width: '2rem', height: '2rem' }" /></div>
            } @else {
                @if (brands().length) {
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-sm text-muted-color">Brand</span>
                        <p-select [options]="brands()" optionLabel="label" optionValue="value" appendTo="body" [ngModel]="brandId()" (ngModelChange)="brandId.set($event)" />
                    </div>
                }
                <div class="flex gap-3 overflow-x-auto pb-2 items-start">
                    @for (d of divisions(); track d.id) {
                        <section class="w-56 shrink-0 rounded-lg bg-surface-50 dark:bg-surface-900 p-2">
                            <div class="font-semibold truncate">{{ d.name }}</div>
                            @if (d.title) {
                                <div class="text-xs text-muted-color truncate mb-1"><i class="pi pi-trophy mr-1"></i>{{ d.title['name'] }}: {{ d.champions.length ? champions(d) : 'Vago' }}</div>
                            }
                            <ol class="list-none m-0 p-0 flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                                @for (e of d.entries; track e.id; let i = $index) {
                                    <li class="flex items-center gap-2 rounded px-2 py-1 text-sm" [class]="e.wrestlerId && scheduled().has(e.wrestlerId) ? 'bg-primary text-primary-contrast' : 'bg-surface-100 dark:bg-surface-800'">
                                        <span class="w-5 text-right opacity-70">{{ i + 1 }}</span>
                                        <span class="flex-1 truncate" [class.font-semibold]="i === 0">{{ name(e) }}</span>
                                        @if (isChampion(d, e)) {
                                            <i class="pi pi-crown text-xs" title="Campeão"></i>
                                        }
                                    </li>
                                } @empty {
                                    <li class="text-sm text-muted-color">Ninguém na divisão.</li>
                                }
                            </ol>
                        </section>
                    } @empty {
                        <p class="text-sm text-muted-color m-0">Nenhuma divisão ativa{{ brandId() ? ' nesta brand' : '' }}.</p>
                    }
                </div>
            }
        </div>
    `
})
export class DivisionRanking {
    private readonly api = inject(Api);

    /** marca em que o ranking abre (a do show do episódio) */
    readonly initialBrandId = input<string | null | undefined>(null);
    /** lutadores já escalados: aparecem destacados na fila */
    readonly scheduled = input<Set<string>>(new Set());

    protected readonly board = signal<CardDivision[] | null>(null);
    protected readonly brandId = signal<string | null>(null);

    protected readonly brands = computed(() => {
        const list = (this.board() ?? []).filter((d) => d['isActive'] !== false).flatMap((d) => d.brands.map((b) => ({ value: b.brandId, label: b.brand['name'] as string })));
        return [...new Map(list.map((b) => [b.value, b])).values()].sort((a, b) => a.label.localeCompare(b.label));
    });

    protected readonly divisions = computed(() => {
        const id = this.brandId();
        return (this.board() ?? []).filter((d) => d['isActive'] !== false && (!id || d.brands.some((b) => b.brandId === id)));
    });

    constructor() {
        void this.load();
    }

    private async load() {
        try {
            const divs = await this.api.get<CardDivision[]>('card-divisions/board');
            this.board.set(divs);
            const ids = this.brands().map((b) => b.value);
            const wanted = this.initialBrandId() ?? null;
            this.brandId.set(wanted && ids.includes(wanted) ? wanted : (ids[0] ?? null));
        } catch {
            this.board.set([]);
        }
    }

    protected champions(d: CardDivision) {
        return d.champions.map((c) => c.name).join(' & ');
    }

    protected name(e: DivisionEntry) {
        return e.wrestler?.name ?? (e.team?.['name'] as string | undefined) ?? '?';
    }

    protected isChampion(d: CardDivision, e: DivisionEntry) {
        return d.champions.some((c) => (c.wrestlerId && c.wrestlerId === e.wrestlerId) || (c.teamId && c.teamId === e.teamId));
    }
}
