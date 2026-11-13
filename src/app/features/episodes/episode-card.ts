import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogService } from 'primeng/dynamicdialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Api } from '../../core/api';
import { MONTHS, gameDayName, roundTitle } from '../../core/format';
import { EpisodeCard, Participant, Segment } from '../../core/models';
import { EPISODE_STATUS, FINISH_TYPE, labelOfOption } from '../../core/resources';
import { resultProblem } from '../../core/segment-result';
import { confirmAction, openDialog } from '../../shared/dialogs';
import { PageHeader } from '../../shared/page-header';
import { SegmentDialog } from './segment-dialog';

@Component({
    selector: 'app-episode-card',
    imports: [DragDropModule, FormsModule, RouterLink, ButtonModule, CheckboxModule, ProgressBarModule, TagModule, TooltipModule, PageHeader],
    templateUrl: './episode-card.html',
    styles: `
        .cdk-drag-placeholder {
            opacity: 0.3;
        }
        .cdk-drag-animating {
            transition: transform 200ms ease;
        }
    `
})
export class EpisodeCardPage {
    /** :id da rota */
    readonly id = input.required<string>();

    private readonly api = inject(Api);
    private readonly dialogs = inject(DialogService);
    private readonly confirmSvc = inject(ConfirmationService);

    protected readonly episode = signal<EpisodeCard | null>(null);
    protected readonly loading = signal(true);

    constructor() {
        effect(() => {
            this.id();
            untracked(() => void this.load());
        });
    }

    protected async load() {
        this.loading.set(true);
        try {
            this.episode.set(await this.api.get<EpisodeCard>(`episodes/${this.id()}/card`));
        } catch {
            this.episode.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    protected heading(e: EpisodeCard): string {
        return e['title'] || e.show['name'];
    }

    protected subtitle(e: EpisodeCard): string {
        return [e.show['name'], MONTHS[e.month - 1], e.week ? `Semana ${e.week}` : '', e['night'] ? `Noite ${e['night']}` : '', gameDayName(e as never)].filter(Boolean).join(' • ');
    }

    protected statusLabel(e: EpisodeCard) {
        return labelOfOption(EPISODE_STATUS, e.status);
    }

    protected finish(s: Segment) {
        return s.finishType ? labelOfOption(FINISH_TYPE, s.finishType) : '';
    }

    /** Lados agrupados: [[Participant, ...], ...] ordenados por lado. */
    protected sides(s: Segment): Participant[][] {
        const map = new Map<number, Participant[]>();
        for (const p of s.participants) map.set(p.side, [...(map.get(p.side) ?? []), p]);
        return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    }

    /**
     * Cor do nome depois da luta realizada: vencedor verde, perdedores vermelho e empate
     * branco (preto no tema claro). Luta ainda não realizada: cor normal.
     */
    protected nameClass(s: Segment, p: Participant): string {
        if (!s.isDone || s.type !== 'MATCH') return p.isWinner ? 'font-semibold' : '';
        if (s.isDraw) return 'font-semibold text-surface-950 dark:text-surface-0';
        const hasWinner = s.participants.some((x) => x.isWinner);
        if (!hasWinner) return '';
        return p.isWinner ? 'font-semibold text-green-500' : 'text-red-500';
    }

    protected stakesLabel(s: Segment): string {
        if (s.stakes === 'NONE' || !s.cardDivision) return '';
        const what = s.stakes === 'CONTENDER' ? 'Desafiante' : 'Subida de divisão';
        return `${what}: ${s.cardDivision['name']}${s.isDone && s.rankingApplied ? ' ✓' : ''}`;
    }

    protected tournamentLabel(s: Segment): string {
        const m = s.tournamentMatch;
        if (!m) return '';
        const t = m.tournament;
        return `${t['name']} · ${roundTitle({ format: t['format'], size: t['size'] }, m)}`;
    }

    protected typeIcon(s: Segment) {
        return s.type === 'MATCH' ? 'pi-user' : s.type === 'PROMO' ? 'pi-megaphone' : 'pi-ellipsis-h';
    }

    protected headline(s: Segment): string {
        if (s.type === 'MATCH') return s.matchType?.['name'] ?? 'Luta';
        return s.type === 'PROMO' ? 'Promo' : 'Segmento';
    }

    protected async toggleStatus(e: EpisodeCard) {
        const status = e.status === 'DONE' ? 'PLANNED' : 'DONE';
        await this.api.put(`episodes/${e.id}`, { status });
        this.episode.set({ ...e, status });
    }

    protected async toggleDone(s: Segment, done: boolean) {
        // Realizada exige resultado (vencedor + como terminou, ou empate): se falta, abre a luta
        if (done && resultProblem({ type: s.type, isDone: true, isDraw: s.isDraw, finishType: s.finishType, participants: s.participants })) {
            await this.openDialog(s, true);
            return;
        }
        await this.api.put(`segments/${s.id}`, { isDone: done }).catch(() => null);
        await this.load();
    }

    protected async drop(ev: CdkDragDrop<Segment[]>) {
        const e = this.episode();
        if (!e || ev.previousIndex === ev.currentIndex) return;
        const segments = [...e.segments];
        moveItemInArray(segments, ev.previousIndex, ev.currentIndex);
        this.episode.set({ ...e, segments });
        try {
            await this.api.put(`episodes/${e.id}/segments/order`, { order: segments.map((s) => s.id) });
        } finally {
            await this.load();
        }
    }

    protected async add() {
        await this.openDialog();
    }

    protected async edit(s: Segment) {
        await this.openDialog(s);
    }

    private async openDialog(segment?: Segment, markDone = false) {
        const saved = await openDialog(this.dialogs, SegmentDialog, segment ? 'Editar segmento' : 'Novo segmento', { episodeId: this.id(), segment, markDone }, '52rem');
        if (saved) await this.load();
    }

    protected async remove(s: Segment) {
        const ok = await confirmAction(this.confirmSvc, {
            title: 'Excluir segmento',
            message: 'Excluir este segmento do card? Os demais sobem uma posição.',
            confirmLabel: 'Excluir',
            danger: true
        });
        if (!ok) return;
        await this.api.delete(`segments/${s.id}`).catch(() => null);
        await this.load();
    }
}
