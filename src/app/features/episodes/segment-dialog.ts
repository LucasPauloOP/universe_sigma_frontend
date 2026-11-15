import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { startWith } from 'rxjs';
import { Api } from '../../core/api';
import { Entity, Participant, Segment } from '../../core/models';
import { resultProblem } from '../../core/segment-result';
import { roundTitle } from '../../core/format';
import { DivisionRanking } from './division-ranking';
import { Refs } from '../../core/refs';
import { FINISH_TYPE, RESOURCES, SEGMENT_TYPE } from '../../core/resources';

/** Luta de torneio ainda sem episódio (GET tournaments/open-matches). */
interface TEntrant {
    wrestlerId: string | null;
    wrestler?: { name: string } | null;
    team?: { name: string; members: { wrestlerId: string }[] } | null;
}
interface TMatch {
    id: string;
    round: number;
    slot: number;
    groupName: string | null;
    tournament: { name: string; format: string; size: number };
    entrantA: TEntrant | null;
    entrantB: TEntrant | null;
    extras?: { entrant: TEntrant }[];
    matchTypeId?: string | null;
}

export interface SegmentDialogData {
    episodeId: string;
    segment?: Segment;
    /** marca do show do episódio: o ranking abre já nela */
    brandId?: string | null;
    /** abre já com "Realizado" marcado (vindo do checkbox do card) */
    markDone?: boolean;
}

@Component({
    selector: 'app-segment-dialog',
    imports: [DivisionRanking, ReactiveFormsModule, FormsModule, ButtonModule, ProgressSpinnerModule, SelectModule, TextareaModule, ToggleSwitchModule],
    templateUrl: './segment-dialog.html'
})
export class SegmentDialog {
    protected readonly ref = inject(DynamicDialogRef);
    protected readonly data = inject(DynamicDialogConfig).data as SegmentDialogData;
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);

    protected readonly types = SEGMENT_TYPE;
    protected readonly finishes = FINISH_TYPE;
    protected readonly stakesOptions = [
        { value: 'NONE', label: 'Nada (luta comum)' },
        { value: 'RANKING', label: 'Vale subida de divisão' },
        { value: 'CONTENDER', label: 'Decide o desafiante' }
    ];
    protected readonly ready = signal(false);
    protected readonly busy = signal(false);

    private readonly s = this.data.segment;
    protected readonly form = new FormGroup({
        type: new FormControl<string>(this.s?.type ?? 'MATCH', Validators.required),
        matchTypeId: new FormControl<string | null>(this.s?.matchTypeId ?? null),
        titleId: new FormControl<string | null>(this.s?.titleId ?? null),
        titleChanged: new FormControl(this.s?.titleChanged ?? false),
        isMainEvent: new FormControl(this.s?.isMainEvent ?? false),
        finishType: new FormControl<string | null>(this.s?.finishType ?? null),
        isDone: new FormControl(this.data.markDone ?? this.s?.isDone ?? false),
        isDraw: new FormControl(this.s?.isDraw ?? false),
        notes: new FormControl(this.s?.notes ?? ''),
        stakes: new FormControl<string>(this.s?.stakes ?? 'NONE'),
        cardDivisionId: new FormControl<string | null>(this.s?.cardDivisionId ?? null),
        tournamentMatchId: new FormControl<string | null>(this.s?.tournamentMatch?.id ?? null),
        startsRivalry: new FormControl(this.s?.startsRivalry ?? false),
        endsRivalry: new FormControl(this.s?.endsRivalry ?? false),
        rivalryId: new FormControl<string | null>(this.s?.endsRivalry ? (this.s?.rivalryId ?? null) : null)
    });
    protected readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), { initialValue: this.form.value });
    protected readonly isMatch = computed(() => this.values().type === 'MATCH');
    protected readonly hasTitle = computed(() => !!this.values().titleId);
    protected readonly hasStakes = computed(() => this.isMatch() && this.values().stakes !== 'NONE');

    // participantes e quantidade de lados
    protected readonly participants = signal<Participant[]>((this.s?.participants ?? []).map((p) => ({ wrestlerId: p.wrestlerId, side: p.side, isWinner: p.isWinner })));
    protected readonly sideCount = signal(Math.max(2, ...(this.s?.participants ?? []).map((p) => p.side)));
    protected readonly sides = computed(() => Array.from({ length: this.sideCount() }, (_, i) => i + 1));

    /** O que falta para poder marcar como realizada (vazio = ok). */
    protected readonly problem = computed(() => {
        const v = this.values();
        return resultProblem({
            type: v.type,
            isDone: !!v.isDone,
            isDraw: !!v.isDraw,
            finishType: v.finishType,
            participants: this.participants()
        });
    });
    protected readonly needsResult = computed(() => this.isMatch() && !!this.values().isDone);

    // rivalidades reconhecidas pela luta montada (para encerrar) — busca ao mudar os participantes
    protected readonly recognized = signal<Entity[]>([]);
    protected readonly rivalryOptions = computed(() => {
        const list = this.recognized()
            // a rivalidade que ESTA luta começou não pode ser encerrada por ela mesma
            .filter((r) => !(this.s?.startsRivalry && r.id === this.s.rivalryId))
            .map((r) => ({ value: r.id, label: r['name'] as string }));
        const cur = this.s?.endsRivalry ? this.s.rivalry : null;
        if (cur && !list.some((o) => o.value === cur.id)) list.unshift({ value: cur.id, label: cur.name });
        return list;
    });
    protected readonly startsRivalry = computed(() => !!this.values().startsRivalry);
    protected readonly endsRivalry = computed(() => !!this.values().endsRivalry);
    protected readonly rivalryMissing = computed(() => this.isMatch() && this.endsRivalry() && !this.values().rivalryId);

    constructor() {
        let seq = 0;
        effect((onCleanup) => {
            const ids = [...new Set(this.participants().map((p) => p.wrestlerId))];
            if (!this.isMatch() || ids.length < 2) {
                this.recognized.set([]);
                return;
            }
            const mine = ++seq;
            const timer = setTimeout(() => {
                this.api
                    .get<Entity[]>(`rivalries/match?wrestlerIds=${ids.join(',')}`)
                    .then((r) => mine === seq && this.recognized.set(r))
                    .catch(() => undefined);
            }, 300);
            onCleanup(() => clearTimeout(timer));
        });
        // começar e encerrar não andam juntos
        this.form.controls.startsRivalry.valueChanges.subscribe((on) => {
            if (!on) return;
            this.form.controls.endsRivalry.setValue(false);
            this.form.controls.rivalryId.setValue(null);
        });
        this.form.controls.endsRivalry.valueChanges.subscribe((on) => {
            if (on) {
                this.form.controls.startsRivalry.setValue(false);
                const opts = this.rivalryOptions();
                if (!this.form.value.rivalryId && opts.length === 1) this.form.controls.rivalryId.setValue(opts[0].value);
            } else {
                this.form.controls.rivalryId.setValue(null);
            }
        });
        // empate não tem vencedor: limpa as estrelas ao marcar
        this.form.controls.isDraw.valueChanges.subscribe((draw) => {
            if (draw) this.participants.update((l) => l.map((p) => ({ ...p, isWinner: false })));
        });
        void Promise.all([this.refs.loadMany(['wrestlers', 'match-types', 'titles', 'card-divisions']), this.api.get<TMatch[]>('tournaments/open-matches').then((m) => this.openMatches.set(m)).catch(() => [])]).then(() => this.ready.set(true));
    }

    protected readonly rankingOpen = signal(false);
    /** Lutadores já escalados neste segmento (destacados no ranking). */
    protected readonly scheduled = computed(() => new Set(this.participants().map((p) => p.wrestlerId)));

    protected readonly matchTypes = computed(() => (this.refs.version(), this.refs.list('match-types').map((e) => ({ value: e.id, label: e['name'] as string }))));
    protected readonly divisionOptions = computed(() => (this.refs.version(), this.refs.list('card-divisions').map((e) => ({ value: e.id, label: RESOURCES['card-divisions'].label(e) }))));
    protected readonly openMatches = signal<TMatch[]>([]);

    private entrantName(e: TEntrant | null) {
        return e ? (e.wrestler?.name ?? e.team?.name ?? '?') : 'a definir';
    }

    /** Luta de torneio: a atual do segmento (se houver) + as que ainda não têm episódio. */
    protected readonly tournamentOptions = computed(() => {
        const list = this.openMatches().map((m) => ({
            value: m.id,
            label: `${m.tournament.name} — ${roundTitle(m.tournament, m)}${m.tournament.format === 'ROUND_ROBIN' ? '' : ' · Luta ' + m.slot}: ${this.entrantName(m.entrantA)} x ${this.entrantName(m.entrantB)}`
        }));
        const cur = this.s?.tournamentMatch;
        if (cur && !list.some((o) => o.value === cur.id)) {
            list.unshift({ value: cur.id, label: `${cur.tournament['name']} — ${roundTitle({ format: cur.tournament['format'], size: cur.tournament['size'] }, cur)} (atual)` });
        }
        return list;
    });

    /** Escolheu a luta do torneio: preenche os lados com os inscritos (se ainda não há participantes). */
    protected pickTournament(id: string | null) {
        const m = this.openMatches().find((x) => x.id === id);
        if (!m || this.participants().length) return;
        const wrestlers = (e: TEntrant | null) => (e ? (e.wrestlerId ? [e.wrestlerId] : (e.team?.members ?? []).map((x) => x.wrestlerId)) : []);
        const sides = [m.entrantA, m.entrantB, ...(m.extras ?? []).map((x) => x.entrant)];
        const used = new Set<string>();
        const list: { wrestlerId: string; side: number; isWinner: boolean }[] = [];
        sides.forEach((entrant, i) => {
            for (const wrestlerId of wrestlers(entrant)) {
                if (used.has(wrestlerId)) continue;
                used.add(wrestlerId);
                list.push({ wrestlerId, side: i + 1, isWinner: false });
            }
        });
        this.participants.set(list);
        this.sideCount.set(Math.max(2, sides.length));
        if (!this.form.value.matchTypeId) {
            const n = sides.filter(Boolean).length;
            const multi = sides.some((e) => wrestlers(e ?? null).length > 1);
            const name = m.matchTypeId ? null : n === 3 ? 'Triple Threat' : n === 4 ? 'Fatal 4-Way' : n > 4 ? 'Battle Royal' : multi ? 'Tag Team' : 'Singles';
            const type = m.matchTypeId ? this.refs.list('match-types').find((t) => t.id === m.matchTypeId) : this.refs.list('match-types').find((t) => t['name'] === name);
            if (type) this.form.controls.matchTypeId.setValue(type.id);
        }
    }

    protected readonly titles = computed(() => (this.refs.version(), this.refs.list('titles').map((e) => ({ value: e.id, label: RESOURCES['titles'].label(e) }))));

    /** Lutadores ainda não escalados (um lutador só aparece uma vez por segmento). */
    protected readonly available = computed(() => {
        this.refs.version();
        const used = new Set(this.participants().map((p) => p.wrestlerId));
        return this.refs
            .list('wrestlers')
            .filter((w) => !used.has(w.id))
            .map((w) => ({ value: w.id, label: w['name'] as string }))
            .sort((a, b) => a.label.localeCompare(b.label));
    });

    protected wrestlerName(id: string) {
        return this.refs.label('wrestlers', id) || '…';
    }

    protected onSide(side: number) {
        return this.participants().filter((p) => p.side === side);
    }

    protected addTo(side: number, id: string | null) {
        if (!id) return;
        this.participants.update((l) => [...l, { wrestlerId: id, side, isWinner: false }]);
    }

    /** Marca o lado inteiro como vencedor (lutas de duplas/times); clicar de novo desfaz. */
    protected toggleSideWinner(side: number) {
        const everyoneWins = this.onSide(side).length > 0 && this.onSide(side).every((p) => p.isWinner);
        this.form.controls.isDraw.setValue(false);
        this.participants.update((l) => l.map((p) => ({ ...p, isWinner: p.side === side ? !everyoneWins : false })));
    }

    protected sideWins(side: number) {
        return this.onSide(side).length > 0 && this.onSide(side).every((p) => p.isWinner);
    }

    protected toggleWinner(p: Participant) {
        this.form.controls.isDraw.setValue(false);
        this.participants.update((l) => l.map((x) => (x.wrestlerId === p.wrestlerId ? { ...x, isWinner: !x.isWinner } : x)));
    }

    protected removeParticipant(p: Participant) {
        this.participants.update((l) => l.filter((x) => x.wrestlerId !== p.wrestlerId));
    }

    protected addSide() {
        this.sideCount.update((n) => n + 1);
    }

    protected removeSide() {
        const last = this.sideCount();
        if (last <= 1) return;
        this.participants.update((l) => l.filter((p) => p.side !== last));
        this.sideCount.set(last - 1);
    }

    protected async save() {
        if (this.form.invalid || this.problem() || this.rivalryMissing()) return;
        this.busy.set(true);
        const v = this.form.getRawValue();
        const isMatch = v.type === 'MATCH';
        const body = {
            episodeId: this.data.episodeId,
            type: v.type,
            matchTypeId: isMatch ? v.matchTypeId : null,
            titleId: isMatch ? v.titleId : null,
            titleChanged: isMatch && !!v.titleId ? !!v.titleChanged : false,
            isMainEvent: !!v.isMainEvent,
            finishType: isMatch ? v.finishType : null,
            stakes: isMatch && v.cardDivisionId ? v.stakes : 'NONE',
            cardDivisionId: isMatch && v.stakes !== 'NONE' ? v.cardDivisionId : null,
            tournamentMatchId: isMatch ? v.tournamentMatchId : null,
            startsRivalry: isMatch && !!v.startsRivalry,
            endsRivalry: isMatch && !!v.endsRivalry && !v.startsRivalry,
            rivalryId: isMatch && v.endsRivalry && !v.startsRivalry ? v.rivalryId : null,
            isDone: !!v.isDone,
            isDraw: isMatch && !!v.isDraw,
            notes: v.notes?.trim() || null,
            participants: this.participants().map(({ wrestlerId, side, isWinner }) => ({ wrestlerId, side, isWinner }))
        };
        try {
            const saved = this.data.segment ? await this.api.put(`segments/${this.data.segment.id}`, body) : await this.api.post('segments', body);
            this.ref.close(saved);
        } catch {
            /* erro exibido pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
