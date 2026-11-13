import { Component, inject } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Loading } from '../core/loading';

/** Barra de progresso no topo + aviso central quando o carregamento demora. */
@Component({
    selector: 'app-global-loader',
    imports: [ProgressBarModule, ProgressSpinnerModule],
    template: `
        @if (loading.visible()) {
            <div class="fixed top-0 left-0 right-0" style="z-index: 3000" role="progressbar" aria-label="Carregando">
                <p-progressbar mode="indeterminate" [style]="{ height: '4px', borderRadius: '0' }" />
            </div>
        }
        @if (loading.slow()) {
            <div class="fixed inset-0 flex items-center justify-center pointer-events-none" style="z-index: 2900" aria-live="polite">
                <div class="flex items-center gap-4 rounded-2xl px-6 py-4 shadow-xl bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700">
                    <p-progress-spinner strokeWidth="5" [style]="{ width: '2rem', height: '2rem' }" />
                    <span class="font-medium">Carregando…</span>
                </div>
            </div>
        }
    `
})
export class GlobalLoader {
    protected readonly loading = inject(Loading);
}
