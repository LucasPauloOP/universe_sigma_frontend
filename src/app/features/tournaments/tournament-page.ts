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
import { Api } from '../../core/api';
import { Bracket, Entrant, TournamentMatch } from '../../core/models';
import { Refs } from '../../core/refs';
import { TOURNAMENT_FORMAT, TOURNAMENT_STATUS, labelOfOption } from '../../core/resources';
import { confirmAction, openDialog } from '../../shared/dialogs';
import { PageHeader } from '../../shared/page-header';
import { MatchDialog, entrantName } from './match-dialog';

interface Round { round: number; title: string; matches: TournamentMatch[] }
interface Group { name: string; matches: TournamentMatch[] }
interface Standing { name: string; played: number; wins: number }

@Component({
  selector: 'app-tournament-page',
  imports: [FormsModule, RouterLink, ButtonModule, InputNumberModule, ProgressBarModule, SelectModule, TagModule, PageHeader],
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
    }).catch(() => null);
    this.newEntrant.set(null);
    this.newSeed.set(null);
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

  protected async editMatch(m: TournamentMatch) {
    const d = this.data();
    if (!d) return;
    const saved = await openDialog(this.dialogs, MatchDialog, 'Editar luta', { match: m, entrants: d.entrants }, '30rem');
    if (saved) await this.load();
  }
}
