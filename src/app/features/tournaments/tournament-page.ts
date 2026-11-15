import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogService } from 'primeng/dynamicdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Api } from '../../core/api';
import { Bracket, Entrant, TournamentMatch } from '../../core/models';
import { Refs } from '../../core/refs';
import { TOURNAMENT_FORMAT, TOURNAMENT_STATUS, labelOfOption } from '../../core/resources';
import { confirmAction, openDialog } from '../../shared/dialogs';
import { PageHeader } from '../../shared/page-header';
import { MatchDialog, competitorsOf, entrantName } from './match-dialog';
import { ScheduleDialog, ScheduleResult } from './schedule-dialog';
import { episodeText, roundName, roundTitle, totalRounds } from '../../core/format';

interface Round { round: number; title: string; matches: TournamentMatch[] }
interface Group { name: string; matches: TournamentMatch[] }
interface Standing { name: string; played: number; wins: number }

@Component({
  selector: 'app-tournament-page',
  imports: [FormsModule, RouterLink, ButtonModule, InputNumberModule, ProgressBarModule, SelectModule, TagModule, TooltipModule, PageHeader],
  templateUrl: './tournament-page.html',
  styles: `
    .match {
      padding: 0.5rem 0.75rem;
      border-radius: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      background: var(--p-content-background);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .match:hover {
      border-color: var(--p-primary-color);
    }
    .win {
      font-weight: 700;
      color: var(--p-primary-color);
    }
  `,
})
export class TournamentPage {
  /** :id da rota */
  readonly id = input.required<string>();

  private readonly api = inject(Api);
  private readonly refs = inject(Refs);
  private readonly dialogs = inject(DialogService);
  private readonly confirmSvc = inject(ConfirmationService);
  private readonly toast = inject(MessageService);

  protected readonly data = signal<Bracket | null>(null);
  protected readonly loading = signal(true);
  protected readonly name = entrantName;
  protected readonly format = (v: unknown) => labelOfOption(TOURNAMENT_FORMAT, v);
  protected readonly status = (v: unknown) => labelOfOption(TOURNAMENT_STATUS, v);

  protected readonly newEntrant = signal<string | null>(null);
  protected readonly newSeed = signal<number | null>(null);
  protected readonly newStartRound = signal<number>(1);

  /** Rodadas em que um inscrito pode entrar (1 = início; depois quartas, semis...). */
  protected readonly startRoundOptions = computed(() => {
    const t = this.data()?.tournament;
    if (!t) return [];
    const total = totalRounds({ size: t['size'], firstRoundMatches: t['firstRoundMatches'] });
    return Array.from({ length: total }, (_, i) => ({
      value: i + 1,
      label: i === 0 ? 'Desde o início (rodada 1)' : roundName(i + 1, total),
    }));
  });

  protected startsAt(e: Entrant): string {
    const t = this.data()?.tournament;
    if (!t || !e.startRound || e.startRound < 2) return '';
    return roundName(e.startRound, totalRounds({ size: t['size'], firstRoundMatches: t['firstRoundMatches'] }));
  }

  protected readonly isRoundRobin = computed(() => this.data()?.tournament['format'] === 'ROUND_ROBIN');

  protected readonly rounds = computed<Round[]>(() => {
    const d = this.data();
    if (!d || this.isRoundRobin()) return [];
    const max = Math.max(0, ...d.matches.map((m) => m.round));
    const byRound = new Map<number, TournamentMatch[]>();
    for (const m of d.matches) byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, matches]) => ({ round, matches, title: this.roundTitle(round, max) }));
  });

  protected readonly groups = computed<Group[]>(() => {
    const d = this.data();
    if (!d || !this.isRoundRobin()) return [];
    const by = new Map<string, TournamentMatch[]>();
    for (const m of d.matches) by.set(m.groupName ?? 'Grupo único', [...(by.get(m.groupName ?? 'Grupo único') ?? []), m]);
    return [...by.entries()].map(([name, matches]) => ({ name, matches }));
  });

  protected readonly standings = computed<Standing[]>(() => {
    const d = this.data();
    if (!d || !this.isRoundRobin()) return [];
    return d.entrants
      .map((e) => {
        const mine = d.matches.filter((m) => m.entrantAId === e.id || m.entrantBId === e.id);
        return {
          name: entrantName(e),
          played: mine.filter((m) => m.winnerId).length,
          wins: mine.filter((m) => m.winnerId === e.id).length,
        };
      })
      .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  });

  protected readonly champion = computed(() => {
    const d = this.data();
    if (!d || this.isRoundRobin() || !this.rounds().length) return null;
    const final = this.rounds().at(-1)!.matches[0];
    return final?.winner ?? null;
  });

  protected readonly pickerOptions = computed(() => {
    this.refs.version();
    const d = this.data();
    if (!d) return [];
    const used = new Set(d.entrants.map((e) => e.wrestlerId ?? e.teamId));
    const key = d.tournament['isTag'] ? 'teams' : 'wrestlers';
    return this.refs
      .list(key)
      .filter((x) => !used.has(x.id))
      .map((x) => ({ value: x.id, label: x['name'] as string }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => void this.load());
    });
  }

  private roundTitle(round: number, max: number) {
    const left = max - round;
    return left === 0 ? 'Final' : left === 1 ? 'Semifinal' : left === 2 ? 'Quartas de final' : `Rodada ${round}`;
  }

  protected async load() {
    this.loading.set(true);
    try {
      const b = await this.api.get<Bracket>(`tournaments/${this.id()}/bracket`);
      this.data.set(b);
      await this.refs.load(b.tournament['isTag'] ? 'teams' : 'wrestlers');
    } catch {
      this.data.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected async addEntrant() {
    const d = this.data();
    const picked = this.newEntrant();
    if (!d || !picked) return;
    const seed = this.newSeed();
    await this.api.post('tournament-entrants', {
      tournamentId: d.tournament.id,
      [d.tournament['isTag'] ? 'teamId' : 'wrestlerId']: picked,
      ...(seed ? { seed } : {}),
      startRound: this.newStartRound(),
    }).catch(() => null);
    this.newEntrant.set(null);
    this.newSeed.set(null);
    this.newStartRound.set(1);
    await this.load();
  }

  protected async removeEntrant(e: Entrant) {
    await this.api.delete(`tournament-entrants/${e.id}`).catch(() => null);
    await this.load();
  }

  protected async generate() {
    const d = this.data();
    if (!d) return;
    if (d.matches.length) {
      const ok = await confirmAction(this.confirmSvc, {
        title: 'Gerar chave novamente',
        message: 'A chave atual (com resultados) será apagada e gerada do zero.',
        confirmLabel: 'Gerar',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await this.api.post(`tournaments/${d.tournament.id}/generate-bracket`);
      this.toast.add({ severity: 'success', summary: 'Chave gerada', life: 3000 });
    } catch {
      /* erro exibido pelo interceptor */
    }
    await this.load();
  }

  protected async setStatus(status: string) {
    const d = this.data();
    if (!d) return;
    await this.api.put(`tournaments/${d.tournament.id}`, { status }).catch(() => null);
    await this.load();
  }

  protected readonly episodeText = episodeText;
  protected readonly competitorsOf = competitorsOf;

  protected scheduled(m: TournamentMatch) {
    return !!m.segmentId;
  }

  /** Quantas lutas da rodada ainda não estão em nenhum episódio. */
  protected unscheduledIn(r: Round) {
    return r.matches.filter((m) => !m.segmentId).length;
  }

  /** Agenda UMA luta num episódio (o card ganha o segmento já com os lutadores). */
  protected async scheduleMatch(m: TournamentMatch) {
    const res = await openDialog<ScheduleResult>(this.dialogs, ScheduleDialog, 'Agendar luta em episódio', { summary: `${this.matchTitle(m)} · ${this.versus(m)}`, askMatchType: true, matchTypeId: m.matchTypeId }, '32rem');
    if (!res) return;
    try {
      await this.api.post(`tournament-matches/${m.id}/schedule`, { episodeId: res.episodeId, ...(res.matchTypeId ? { matchTypeId: res.matchTypeId } : {}) });
      this.toast.add({ severity: 'success', summary: 'Luta agendada no episódio', life: 3000 });
    } catch {
      /* erro exibido pelo interceptor */
    }
    await this.load();
  }

  /** Agenda a rodada inteira (ex.: as 4 lutas das quartas) no mesmo episódio. */
  protected async scheduleRound(r: Round) {
    const left = this.unscheduledIn(r);
    const res = await openDialog<ScheduleResult>(this.dialogs, ScheduleDialog, `Agendar ${r.title.toLowerCase()}`, { summary: `${r.title}: ${left} luta(s) ainda sem episódio entram no episódio escolhido.`, askMatchType: false }, '32rem');
    if (!res) return;
    try {
      const out = await this.api.post<{ scheduled: number }>(`tournaments/${this.id()}/schedule-round`, { round: r.round, episodeId: res.episodeId });
      this.toast.add({ severity: 'success', summary: `${out['scheduled']} luta(s) agendada(s)`, life: 3000 });
    } catch {
      /* erro exibido pelo interceptor */
    }
    await this.load();
  }

  protected async unlinkMatch(m: TournamentMatch) {
    const ok = await confirmAction(this.confirmSvc, {
      title: 'Desvincular do episódio',
      message: 'A luta da chave deixa de apontar para o episódio. O segmento continua no card e pode ser apagado lá.',
      confirmLabel: 'Desvincular'
    });
    if (!ok) return;
    await this.api.post(`tournament-matches/${m.id}/unlink`).catch(() => null);
    await this.load();
  }

  /** "A x B x C" (ou "a definir" nas vagas vazias). */
  protected versus(m: TournamentMatch): string {
    const names = competitorsOf(m).map((e) => this.name(e));
    return names.length ? names.join(' x ') + (names.length < 2 ? ' x a definir' : '') : 'a definir';
  }

  protected matchTitle(m: TournamentMatch): string {
    const t = this.data()?.tournament;
    if (!t) return '';
    return roundTitle({ format: t['format'], size: t['size'], firstRoundMatches: t['firstRoundMatches'] }, m) + (this.isRoundRobin() ? '' : ` · Luta ${m.slot}`);
  }

  protected async editMatch(m: TournamentMatch) {
    const d = this.data();
    if (!d) return;
    const saved = await openDialog(this.dialogs, MatchDialog, 'Editar luta', { match: m, entrants: d.entrants }, '30rem');
    if (saved) await this.load();
  }
}
