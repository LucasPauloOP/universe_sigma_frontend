import { Component, computed, inject, input, signal } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Api } from '../../core/api';
import { Entity } from '../../core/models';
import { rivalrySides } from '../../core/resources';

/** Rivalidades ativas (somente leitura) para apoiar o planejamento do episódio. */
@Component({
    selector: 'app-active-rivalries',
    imports: [ProgressSpinnerModule],
    template: `
        <div class="rounded-xl border border-surface-200 dark:border-surface-700 p-3">
            @if (!items()) {
                <div class="flex justify-center p-4"><p-progress-spinner strokeWidth="4" [style]="{ width: '2rem', height: '2rem' }" /></div>
            } @else {
                <div class="font-semibold mb-2">Rivalidades ativas ({{ active().length }})</div>
                <div class="flex flex-col gap-2">
                    @for (r of active(); track r['id']) {
                        <div class="rounded-lg p-2 text-sm" [class]="inCard(r) ? 'bg-primary text-primary-contrast' : 'bg-surface-100 dark:bg-surface-800'">
                            <div class="flex items-center gap-2">
                                <span class="font-semibold flex-1">{{ vs(r) }}</span>
                                @if (inCard(r)) {
                                    <span class="text-xs opacity-80">neste card</span>
                                }
                            </div>
                            @if (r['startDate']) {
                                <div class="text-xs opacity-70">Desde {{ r['startDate'] }}</div>
                            }
                        </div>
                    } @empty {
                        <p class="text-sm text-muted-color m-0">Nenhuma rivalidade ativa.</p>
                    }
                </div>
            }
        </div>
    `
})
export class ActiveRivalries {
    private readonly api = inject(Api);

    /** ids de rivalidades ligadas às lutas deste card (destacadas) */
    readonly inCardIds = input<Set<string>>(new Set());

    protected readonly items = signal<Entity[] | null>(null);
    protected readonly active = computed(() => (this.items() ?? []).filter((r) => r['isActive'] !== false));

    constructor() {
        void this.load();
    }

    private async load() {
        try {
            this.items.set(await this.api.all('rivalries'));
        } catch {
            this.items.set([]);
        }
    }

    protected vs(r: Entity) {
        return rivalrySides(r).map((s) => s.join(' & ')).join(' vs ') || (r['name'] as string);
    }

    protected inCard(r: Entity) {
        return this.inCardIds().has(r['id'] as string);
    }
}
