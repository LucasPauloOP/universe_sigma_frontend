import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogService } from 'primeng/dynamicdialog';
import { MenuModule } from 'primeng/menu';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { Api } from '../../core/api';
import { GAME_WEEKDAYS, MONTHS, SEASON_MONTHS, beforeStart, compareEpisodes, gameDayName, gameDayOffset, gameWeek } from '../../core/format';
import { Entity } from '../../core/models';
import { Refs } from '../../core/refs';
import { EPISODE_STATUS, EPISODE_STATUS_COLOR, EPISODE_STATUS_SEVERITY, RESOURCES, labelOfOption, reopenedStatus } from '../../core/resources';
import { UniverseStore } from '../../core/universe-store';
import { confirmAction, openDialog } from '../../shared/dialogs';
import { PageHeader } from '../../shared/page-header';
import { GenerateEpisodes } from '../resources/generate-episodes';
import { SuggestSegmentsDialog } from './suggest-segments-dialog';
import { ResourceForm } from '../resources/resource-form';

interface MonthGroup {
    month: number;
    name: string;
    episodes: Entity[];
    done: number;
}

@Component({
    selector: 'app-episodes-page',
    imports: [FormsModule, RouterLink, ButtonModule, MenuModule, ProgressBarModule, SelectModule, SelectButtonModule, TabsModule, TagModule, PageHeader],
    templateUrl: './episodes-page.html'
})
export class EpisodesPage {
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);
    private readonly store = inject(UniverseStore);
    private readonly dialogs = inject(DialogService);
    private readonly confirmSvc = inject(ConfirmationService);
    private readonly toast = inject(MessageService);
    private readonly router = inject(Router);

    protected readonly loading = signal(true);
    private readonly episodes = signal<Entity[]>([]);
    protected readonly seasons = signal<Entity[]>([]);
    protected readonly seasonId = signal<string | null>(null);
    protected readonly showId = signal<string | null>(null);
    protected readonly tab = signal<'weekly' | 'ple'>('weekly');
    protected readonly view = signal<'cards' | 'calendar'>('cards');
    protected readonly viewOptions = [
        { label: 'Cards', value: 'cards', icon: 'pi pi-th-large' },
        { label: 'Calendário', value: 'calendar', icon: 'pi pi-calendar' }
    ];
    protected readonly weekdayNames = GAME_WEEKDAYS.map((d) => d.slice(0, 3));
    protected readonly weekRows = [1, 2, 3, 4];
    /** mês exibido no calendário (1 a 12) */
    protected readonly calMonth = signal<number | null>(null);

    protected readonly seasonOptions = computed(() => this.seasons().map((s) => ({ value: s.id, label: RESOURCES['seasons'].label(s) })));

    /** Episódios da temporada escolhida, na ordem de jogo (maio → abril). */
    private readonly ofSeason = computed(() =>
        this.episodes()
            .filter((e) => e['seasonId'] === this.seasonId())
            .sort((a, b) => compareEpisodes(a as never, b as never))
    );

    protected readonly startMonth = computed<number>(() => this.seasons().find((s) => s.id === this.seasonId())?.['startMonth'] ?? 5);
    protected readonly showEarlier = signal(false);

    /** Meses anteriores ao início do universe nesta temporada: não entram no jogo. */
    protected readonly earlierCount = computed(() => this.ofSeason().filter((e) => beforeStart(e['month'], this.startMonth())).length);
    protected readonly startName = computed(() => MONTHS[this.startMonth() - 1]);

    /** Episódios que contam para o jogo (do mês de início em diante). */
    private readonly playable = computed(() => this.ofSeason().filter((e) => !beforeStart(e['month'], this.startMonth())));

    /** O primeiro ainda planejado: é o próximo a ser jogado. */
    protected readonly nextId = computed(() => this.playable().find((e) => e['status'] === 'PLANNED')?.id ?? null);

    private isWeekly = (e: Entity) => e['show']?.kind === 'WEEKLY';

    protected readonly showOptions = computed(() => {
        const wantWeekly = this.tab() === 'weekly';
        const seen = new Map<string, string>();
        for (const e of this.ofSeason()) if (this.isWeekly(e) === wantWeekly) seen.set(e['showId'], e['show']?.name);
        return [...seen.entries()].map(([value, label]) => ({ value, label }));
    });

    protected readonly counts = computed(() => ({
        weekly: this.playable().filter((e) => this.isWeekly(e)).length,
        ple: this.playable().filter((e) => !this.isWeekly(e)).length
    }));

    protected before(e: Entity) {
        return beforeStart(e['month'], this.startMonth());
    }

    protected readonly groups = computed<MonthGroup[]>(() => {
        const wantWeekly = this.tab() === 'weekly';
        const sid = this.showId();
        const base = this.showEarlier() ? this.ofSeason() : this.playable();
        const list = base.filter((e) => this.isWeekly(e) === wantWeekly && (!sid || e['showId'] === sid));
        return SEASON_MONTHS.map((month) => {
            const episodes = list.filter((e) => e['month'] === month);
            return { month, name: MONTHS[month - 1], episodes, done: episodes.filter((e) => e['status'] === 'DONE').length };
        }).filter((g) => g.episodes.length);
    });

    /** Meses do calendário (maio → abril) que têm episódios. */
    protected readonly calMonths = computed(() => {
        const base = this.showEarlier() ? this.ofSeason() : this.playable();
        return SEASON_MONTHS.filter((m) => base.some((e) => e['month'] === m)).map((month) => ({ month, label: MONTHS[month - 1] }));
    });

    protected readonly calCurrent = computed<{ month: number; label: string } | null>(() => this.calMonths().find((m) => m.month === this.calMonth()) ?? this.calMonths()[0] ?? null);

    /** 4 semanas × 7 dias (segunda a domingo): o mês do jogo sempre tem 4 semanas. */
    protected readonly calRows = computed<Entity[][][]>(() => {
        const cur = this.calCurrent();
        const rows: Entity[][][] = this.weekRows.map(() => Array.from({ length: 7 }, () => []));
        if (!cur) return rows;
        const base = this.showEarlier() ? this.ofSeason() : this.playable();
        for (const e of base.filter((x) => x['month'] === cur.month).sort((a, b) => compareEpisodes(a as never, b as never))) {
            rows[gameWeek(e['week']) - 1][gameDayOffset(e as never)].push(e);
        }
        return rows;
    });

    protected calStep(delta: number) {
        const list = this.calMonths();
        const i = list.findIndex((m) => m.month === this.calCurrent()?.month);
        const next = list[i + delta];
        if (next) this.calMonth.set(next.month);
    }

    protected calHasPrev = computed(() => this.calMonths().findIndex((m) => m.month === this.calCurrent()?.month) > 0);
    protected calHasNext = computed(() => {
        const list = this.calMonths();
        return list.findIndex((m) => m.month === this.calCurrent()?.month) < list.length - 1;
    });

    /** Nome curto no calendário: "RAW" ou "WrestleMania · N1". */
    protected chip(e: Entity): string {
        return `${e['show']?.name ?? 'Episódio'}${e['night'] ? ' · N' + e['night'] : ''}`;
    }

    protected dateLabel(e: Entity): string {
        return gameDayName(e as never);
    }

    constructor() {
        effect(() => {
            if (this.store.currentId()) untracked(() => void this.load());
        });
    }

    private async load() {
        this.loading.set(true);
        try {
            const [episodes, seasons] = await Promise.all([this.api.all('episodes'), this.api.all('seasons')]);
            this.episodes.set(episodes);
            this.seasons.set(seasons.sort((a, b) => a['number'] - b['number']));
            if (!this.seasons().some((s) => s.id === this.seasonId())) {
                // temporada em andamento: a primeira que ainda tem episódio planejado
                const current = this.seasons().find((s) => episodes.some((e) => e['seasonId'] === s.id && e['status'] !== 'DONE'));
                this.seasonId.set((current ?? this.seasons().at(-1))?.id ?? null);
            }
        } catch {
            this.episodes.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    protected setTab(t: string | number | undefined) {
        this.tab.set(t === 'ple' ? 'ple' : 'weekly');
        this.showId.set(null);
    }

    protected open(e: Entity) {
        void this.router.navigate(['/episodes', e.id, 'card']);
    }

    protected title(e: Entity): string {
        return e['title'] || e['show']?.name || 'Episódio';
    }

    protected whenLabel(e: Entity): string {
        const m = MONTHS[e['month'] - 1];
        const when = e['week'] ? `${m} · semana ${e['week']}` : m;
        return e['night'] ? `${when} · Noite ${e['night']}` : when;
    }

    protected statusColor(e: Entity): string {
        return EPISODE_STATUS_COLOR[e['status']] ?? 'var(--p-surface-300)';
    }

    protected statusSeverity(e: Entity) {
        return EPISODE_STATUS_SEVERITY[e['status']] ?? 'secondary';
    }

    protected statusLabel(e: Entity): string {
        return labelOfOption(EPISODE_STATUS, e['status']);
    }

    protected menuFor(e: Entity): MenuItem[] {
        return [
            { label: 'Abrir card', icon: 'pi pi-list', command: () => this.open(e) },
            { label: e['status'] === 'DONE' ? (this.segmentsOf(e) > 0 ? 'Marcar como planejado' : 'Marcar como sem planejamento') : 'Marcar como realizado', icon: e['status'] === 'DONE' ? 'pi pi-clock' : 'pi pi-check-circle', command: () => this.toggleStatus(e) },
            { label: 'Editar', icon: 'pi pi-pencil', command: () => this.edit(e) },
            { label: 'Excluir', icon: 'pi pi-trash', styleClass: 'text-red-500', command: () => this.remove(e) }
        ];
    }

    private segmentsOf(e: Entity): number {
        return e['_count']?.segments ?? 0;
    }

    protected async toggleStatus(e: Entity) {
        await this.api.put(`episodes/${e.id}`, { status: e['status'] === 'DONE' ? reopenedStatus(this.segmentsOf(e)) : 'DONE' }).catch(() => null);
        await this.load();
    }

    protected async add() {
        await this.form();
    }

    protected async edit(e: Entity) {
        await this.form(e);
    }

    private async form(entity?: Entity) {
        const res = RESOURCES['episodes'];
        const saved = await openDialog(this.dialogs, ResourceForm, `${entity ? 'Editar' : 'Novo'} episódio`, { res, entity }, '44rem');
        if (!saved) return;
        this.refs.invalidate('episodes');
        await this.load();
    }

    protected async remove(e: Entity) {
        const ok = await confirmAction(this.confirmSvc, {
            title: 'Excluir episódio',
            message: `Excluir "${this.title(e)}" (${this.whenLabel(e)}) e o card dele?`,
            confirmLabel: 'Excluir',
            danger: true
        });
        if (!ok) return;
        await this.api.delete(`episodes/${e.id}`).catch(() => null);
        await this.load();
    }

    protected async planWithAi() {
        const saved = await openDialog<number>(this.dialogs, SuggestSegmentsDialog, 'Planejar período com IA', { seasonId: this.seasonId() }, '52rem');
        if (!saved) return;
        this.toast.add({ severity: 'success', summary: `${saved} episódio(s) planejado(s)`, life: 4000 });
        await this.load();
    }

    protected async generate() {
        const created = await openDialog<number>(this.dialogs, GenerateEpisodes, 'Gerar episódios', undefined, '32rem');
        if (created === undefined) return;
        this.toast.add({ severity: created ? 'success' : 'info', summary: created ? `${created} episódio(s) criado(s)` : 'Nenhum episódio novo: tudo já existia', life: 4000 });
        await this.load();
    }
}
