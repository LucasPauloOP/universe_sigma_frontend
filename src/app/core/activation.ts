import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Api } from './api';
import { Entity } from './models';
import { confirmAction } from '../shared/dialogs';

interface Impact {
  shows: string[];
  episodes: number;
  segments: number;
}

/** Recursos que podem ser desativados e o que acontece quando são. */
export const ACTIVATABLE = ['shows', 'brands'];

/**
 * Desativar um show apaga os episódios dele; desativar uma brand desativa os shows dela
 * (e apaga os episódios). Pergunta antes e devolve se pode seguir (e se deve mandar `confirm`).
 */
@Injectable({ providedIn: 'root' })
export class Activation {
  private readonly api = inject(Api);
  private readonly confirmSvc = inject(ConfirmationService);

  /** `null` = usuário cancelou. Senão, o corpo extra ({ confirm: true } quando houve aviso). */
  async confirmDeactivation(resKey: 'shows' | 'brands', entity: Entity): Promise<{ confirm?: true } | null> {
    const impact = await this.api.get<Impact & Entity>(`${resKey}/${entity.id}/impact`);
    const hasEffect = impact.episodes > 0 || (resKey === 'brands' && impact.shows.length > 0);
    if (!hasEffect) return {};

    const name = entity['name'];
    const cards = `${impact.episodes} episódio(s)${impact.segments ? ` e ${impact.segments} segmento(s) já montados nos cards` : ''}`;
    const message =
      resKey === 'shows'
        ? `Desativar "${name}" vai APAGAR ${cards}. Isso não pode ser desfeito.`
        : `Desativar a brand "${name}" vai desativar ${impact.shows.length ? 'os shows ' + impact.shows.join(', ') : 'seus shows'} e APAGAR ${cards}. Isso não pode ser desfeito.`;
    const ok = await confirmAction(this.confirmSvc, {
      title: resKey === 'shows' ? 'Desativar show' : 'Desativar brand',
      message,
      confirmLabel: 'Desativar e apagar',
      danger: true
    });
    return ok ? { confirm: true } : null;
  }

  /** Liga/desliga direto da lista. Devolve true se algo mudou. */
  async setActive(resKey: 'shows' | 'brands', entity: Entity, active: boolean): Promise<boolean> {
    let extra: { confirm?: true } | null = {};
    if (!active) extra = await this.confirmDeactivation(resKey, entity);
    if (extra === null) return false;
    try {
      await this.api.put(`${resKey}/${entity.id}`, { isActive: active, ...extra });
      return true;
    } catch {
      return false;
    }
  }
}
