import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { Api } from '../../core/api';
import { RangeJob, SuggestedEpisode, SuggestedSegment, sidesOf, toBulkItems, withoutSegment } from '../../core/ai-plan';
import { fmtDate } from '../../core/format';
import { Refs } from '../../core/refs';

export interface SuggestSegmentsData {
    /** com episodeId gera só aquele episódio; sem ele, planeja um período */
    episodeId?: string;
    episodeLabel?: string;
}

type Step = 'form' | 'running' | 'preview';

@Component({
    selector: 'app-suggest-segments-dialog',
    imports: [FormsModule, ReactiveFormsModule, ButtonModule, CheckboxModule, InputNumberModule, MultiSelectModule, ProgressBarModule, TagModule, TextareaModule],
    templateUrl: './suggest-segments-dialog.html'
})
export class SuggestSegmentsDialog implements OnDestroy {
    protected readonly ref = inject(DynamicDialogRef);
    protected readonly data = (inject(DynamicDialogConfig).data ?? {}) as SuggestSegmentsData;
    private readonly api = inject(Api);
    protected readonly refs = inject(Refs);
    private readonly toast = inject(MessageService);

    protected readonly single = !!this.data.episodeId;
    protected readonly step = signal<Step>('form');
    protected readonly busy = signal(false);
    protected readonly error = signal<string | null>(null);
    protected readonly job = signal<RangeJob | null>(null);
    protected readonly episodes = signal<SuggestedEpisode[]>([]);
    protected readonly selected = signal<Set<string>>(new Set());
    protected readonly replace = signal(false);
    protected readonly fmtDate = fmtDate;
    protected readonly sidesOf = sidesOf;

    protected readonly shows = computed(() => (this.refs.version(), this.refs.list('shows').map((e) => ({ value: e.id, label: e['name'] as string }))));
    protected readonly progress = computed(() => {
        const j = this.job();
        return j && j.total ? Math.round((j.done / j.total) * 100) : 0;
    });
    protected readonly saveCount = computed(() => this.episodes().filter((e) => this.selected().has(e.episodeId) && e.segments.length).length);

    protected readonly form = inject(FormBuilder).group({
        from: ['' as string, this.single ? [] : Validators.required],
        to: ['' as string, this.single ? [] : Validators.required],
        showIds: [[] as string[]],
        count: [5 as number, [Validators.required, Validators.min(1), Validators.max(10)]],
        includeMainEvent: [true],
        skipPlanned: [true],
        guidance: ['' as string, Validators.maxLength(500)]
    });

    private timer: ReturnType<typeof setTimeout> | null = null;
    private jobId: string | null = null;

    constructor() {
        void this.refs.loadMany(['shows', 'match-types', 'titles', 'card-divisions']);
    }

    ngOnDestroy() {
        if (this.timer) clearTimeout(this.timer);
    }

    private options() {
        const { count, includeMainEvent, guidance } = this.form.getRawValue();
        return { count, includeMainEvent, ...(guidance?.trim() ? { guidance: guidance.trim() } : {}) };
    }

    protected async generate() {
        if (this.form.invalid) return;
        this.error.set(null);
        this.busy.set(true);
        try {
            if (this.single) {
                this.step.set('running');
                const res = await this.api.post<SuggestedEpisode>(`episodes/${this.data.episodeId}/segments/suggest`, this.options());
                this.showPreview([res]);
            } else {
                const { from, to, showIds, skipPlanned } = this.form.getRawValue();
                const res = await this.api.post<{ jobId: string; total: number }>('episodes/suggest-range', {
                    from,
                    to,
                    skipPlanned,
                    ...(showIds?.length ? { showIds } : {}),
                    ...this.options()
                });
                this.jobId = res.jobId;
                this.step.set('running');
                this.job.set({ id: res.jobId, status: 'running', total: res.total, done: 0, current: null, error: null, episodes: [] });
                this.poll();
            }
        } catch (e) {
            this.step.set('form');
            this.error.set((e as { error?: { message?: string } })?.error?.message ?? 'Não foi possível gerar. Tente de novo.');
        } finally {
            this.busy.set(false);
        }
    }

    private poll() {
        this.timer = setTimeout(async () => {
            try {
                const j = await this.api.get<RangeJob>(`episodes/suggest-range/${this.jobId}`);
                this.job.set(j);
                if (j.status === 'running') return this.poll();
                if (j.status === 'error' && !j.episodes.some((e) => e.segments.length)) {
                    this.step.set('form');
                    this.error.set(j.error ?? 'A geração falhou.');
                    return;
                }
                if (j.status === 'error' && j.error) this.toast.add({ severity: 'warn', summary: 'Geração interrompida', detail: `${j.error} Os episódios já gerados foram mantidos na prévia.`, life: 8000 });
                this.showPreview(j.episodes);
            } catch {
                this.step.set('form');
                this.error.set('Perdi o andamento da geração (o servidor pode ter reiniciado). Gere de novo.');
            }
        }, 2500);
    }

    protected async cancel() {
        if (this.timer) clearTimeout(this.timer);
        if (this.jobId) {
            try {
                const j = (await this.api.delete(`episodes/suggest-range/${this.jobId}`)) as RangeJob;
                // o job termina o episódio em andamento; mostra o que já saiu
                this.showPreview(j?.episodes ?? this.job()?.episodes ?? []);
                return;
            } catch {
                /* cai no fechamento */
            }
        }
        this.ref.close();
    }

    private showPreview(list: SuggestedEpisode[]) {
        this.episodes.set(list);
        this.selected.set(new Set(list.filter((e) => e.segments.length).map((e) => e.episodeId)));
        this.step.set('preview');
    }

    protected toggle(id: string, on: boolean) {
        const next = new Set(this.selected());
        if (on) next.add(id);
        else next.delete(id);
        this.selected.set(next);
    }

    protected removeSegment(episodeId: string, index: number) {
        this.episodes.update((list) => list.map((e) => (e.episodeId === episodeId ? withoutSegment(e, index) : e)));
    }

    protected segmentTitle(s: SuggestedSegment): string {
        if (s.type !== 'MATCH') return s.type === 'PROMO' ? 'Promo' : 'Segmento';
        return this.refs.label('match-types', s.matchTypeId) || 'Luta';
    }

    protected async save() {
        const items = toBulkItems(this.episodes(), this.selected(), this.replace());
        if (!items.length) return;
        this.busy.set(true);
        this.error.set(null);
        try {
            if (this.single) {
                await this.api.post(`episodes/${this.data.episodeId}/segments`, { replace: this.replace(), segments: items[0].segments });
                this.ref.close(1);
                return;
            }
            const res = await this.api.post<{ results: { episodeId: string; ok: boolean; error?: string }[] }>('episodes/segments/bulk', { items });
            const failed = res.results.filter((r) => !r.ok);
            const ok = res.results.length - failed.length;
            if (failed.length) {
                // mantém na prévia só o que falhou, com o motivo
                const reason = new Map(failed.map((f) => [f.episodeId, f.error ?? 'erro']));
                this.episodes.update((list) => list.filter((e) => reason.has(e.episodeId)).map((e) => ({ ...e, error: reason.get(e.episodeId) })));
                this.selected.set(new Set(reason.keys()));
                this.toast.add({ severity: 'warn', summary: `${ok} episódio(s) gravado(s), ${failed.length} com erro`, detail: 'Os que falharam continuam na prévia.', life: 8000 });
                return;
            }
            this.ref.close(ok);
        } catch (e) {
            this.error.set((e as { error?: { message?: string } })?.error?.message ?? 'Não foi possível gravar.');
        } finally {
            this.busy.set(false);
        }
    }
}
