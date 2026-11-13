import { Component, computed, inject, signal } from '@angular/core';
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
import { Participant, Segment } from '../../core/models';
import { Refs } from '../../core/refs';
import { FINISH_TYPE, RESOURCES, SEGMENT_TYPE } from '../../core/resources';

export interface SegmentDialogData {
    episodeId: string;
    segment?: Segment;
}

@Component({
    selector: 'app-segment-dialog',
    imports: [ReactiveFormsModule, FormsModule, ButtonModule, ProgressSpinnerModule, SelectModule, TextareaModule, ToggleSwitchModule],
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
        isDone: new FormControl(this.s?.isDone ?? false),
        notes: new FormControl(this.s?.notes ?? ''),
        stakes: new FormControl<string>(this.s?.stakes ?? 'NONE'),
        cardDivisionId: new FormControl<string | null>(this.s?.cardDivisionId ?? null)
    });
    private readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), { initialValue: this.form.value });
    protected readonly isMatch = computed(() => this.values().type === 'MATCH');
    protected readonly hasTitle = computed(() => !!this.values().titleId);
    protected readonly hasStakes = computed(() => this.isMatch() && this.values().stakes !== 'NONE');

    // participantes e quantidade de lados
    protected readonly participants = signal<Participant[]>((this.s?.participants ?? []).map((p) => ({ wrestlerId: p.wrestlerId, side: p.side, isWinner: p.isWinner })));
    protected readonly sideCount = signal(Math.max(2, ...(this.s?.participants ?? []).map((p) => p.side)));
    protected readonly sides = computed(() => Array.from({ length: this.sideCount() }, (_, i) => i + 1));

    constructor() {
        void this.refs.loadMany(['wrestlers', 'match-types', 'titles', 'card-divisions']).then(() => this.ready.set(true));
    }

    protected readonly matchTypes = computed(() => (this.refs.version(), this.refs.list('match-types').map((e) => ({ value: e.id, label: e['name'] as string }))));
    protected readonly divisionOptions = computed(() => (this.refs.version(), this.refs.list('card-divisions').map((e) => ({ value: e.id, label: RESOURCES['card-divisions'].label(e) }))));
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

    protected toggleWinner(p: Participant) {
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
        if (this.form.invalid) return;
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
            isDone: !!v.isDone,
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
