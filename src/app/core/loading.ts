import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

/**
 * Estado de carregamento da aplicação: requisições HTTP em andamento e troca de tela
 * (inclui baixar a página lazy). O indicador só aparece depois de um instante, para
 * não piscar nas respostas rápidas, e uma mensagem maior surge quando demora.
 */
@Injectable({ providedIn: 'root' })
export class Loading {
  private readonly pending = signal(0);
  private readonly navigating = signal(false);
  readonly busy = computed(() => this.pending() > 0 || this.navigating());

  /** barra no topo (após ~150 ms) */
  readonly visible = signal(false);
  /** aviso central "Carregando…" quando demora (após ~700 ms) */
  readonly slow = signal(false);

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const router = inject(Router);
    router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.navigating.set(true);
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.navigating.set(false);
    });

    effect(() => {
      const busy = this.busy();
      untracked(() => {
        if (busy) {
          this.showTimer ??= setTimeout(() => this.visible.set(true), 150);
          this.slowTimer ??= setTimeout(() => this.slow.set(true), 700);
        } else {
          if (this.showTimer) clearTimeout(this.showTimer);
          if (this.slowTimer) clearTimeout(this.slowTimer);
          this.showTimer = this.slowTimer = null;
          this.visible.set(false);
          this.slow.set(false);
        }
      });
    });
  }

  start() {
    this.pending.update((n) => n + 1);
  }

  stop() {
    this.pending.update((n) => Math.max(0, n - 1));
  }
}
