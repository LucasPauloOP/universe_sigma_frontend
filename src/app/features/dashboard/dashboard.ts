import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { Api } from '../../core/api';
import { MONTHS, beforeStart, compareEpisodes, fmtDate, gameDayName } from '../../core/format';
import { Entity } from '../../core/models';
import { RESOURCES } from '../../core/resources';
import { UniverseStore } from '../../core/universe-store';
import { PageHeader } from '../../shared/page-header';

interface Stat {
    key: string;
    label: string;
    icon: string;
    total: number;
}
interface NextEp {
    id: string;
    show: string;
    title: string;
    when: string;
    season: string;
    color: string | null;
}
interface Champion {
    title: string;
    holders: string;
    since: string;
}

const STAT_KEYS = ['wrestlers', 'teams', 'titles', 'shows', 'episodes', 'tournaments', 'rivalries'];

@Component({
    selector: 'app-dashboard',
    imports: [RouterLink, ButtonModule, ProgressBarModule, PageHeader],
    template: `
        <app-page-header [title]="store.current()?.name ?? 'Painel'" [subtitle]="store.current()?.description ?? ''" />
        @if (loading()) {
            <p-progressbar mode="indeterminate" [style]="{ height: '4px' }" />
        }

        @if (upcoming()[0]; as next) {
            <div class="card mt-2 flex flex-wrap items-center gap-4" [style.border-left]="'4px solid ' + (next.color ?? 'var(--p-primary-color)')">
                <span class="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-primary-contrast"><i class="pi pi-play text-xl"></i></span>
                <div class="min-w-0 flex-1">
                    <div class="text-sm text-muted-color">Próximo episódio a jogar</div>
                    <div class="text-xl font-semibold truncate">{{ next.show }}</div>
                    <div class="text-muted-color">{{ next.when }} · {{ next.season }}{{ next.title && next.title !== next.show ? ' · ' + next.title : '' }}</div>
                </div>
                <p-button label="Abrir card" icon="pi pi-list" [routerLink]="['/episodes', next.id, 'card']" />
            </div>
            @if (upcoming().length > 1) {
                <div class="flex flex-wrap items-center gap-2 mt-3 text-sm">
                    <span class="text-muted-color">Em seguida:</span>
                    @for (u of upcoming().slice(1); track u.id) {
                        <a [routerLink]="['/episodes', u.id, 'card']" class="no-underline px-3 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-inherit">{{ u.show }} · {{ u.when }}</a>
                    }
                </div>
            }
        } @else if (!loading()) {
            <div class="card mt-2 text-muted-color">Nenhum episódio planejado. Gere o calendário em <a routerLink="/episodes" class="text-primary">Episódios</a>.</div>
        }

        <div class="grid grid-cols-12 gap-4 mt-2">
            @for (s of stats(); track s.key) {
                <a [routerLink]="['/r', s.key]" class="col-span-6 md:col-span-4 xl:col-span-3 no-underline text-inherit">
                    <div class="card flex items-center gap-4 hover:bg-surface-50 dark:hover:bg-surface-900 transition-colors">
                        <span class="w-12 h-12 rounded-xl flex items-center justify-center bg-primary-100 dark:bg-primary-400/20 text-primary">
                            <i [class]="'pi pi-' + s.icon + ' text-xl'"></i>
                        </span>
                        <div>
                            <div class="text-3xl font-semibold leading-none">{{ s.total }}</div>
                            <div class="text-muted-color mt-1">{{ s.label }}</div>
                        </div>
                    </div>
                </a>
            }
        </div>

        <h2 class="text-xl font-semibold mt-8 mb-3">Campeões atuais</h2>
        @if (champions().length) {
            <div class="grid grid-cols-12 gap-4">
                @for (c of champions(); track c.title) {
                    <div class="col-span-12 md:col-span-6 xl:col-span-4">
                        <div class="card h-full">
                            <div class="text-muted-color text-sm flex items-center gap-2"><i class="pi pi-trophy"></i>{{ c.title }}</div>
                            <div class="text-lg font-semibold my-1">{{ c.holders }}</div>
                            <div class="text-muted-color text-sm">desde {{ c.since }}</div>
                        </div>
                    </div>
                }
            </div>
        } @else if (!loading()) {
            <p class="text-muted-color">Nenhum reinado em aberto. Cadastre em <a routerLink="/r/title-reigns" class="text-primary">Reinados</a>.</p>
        }
    `
})
export class Dashboard {
    protected readonly store = inject(UniverseStore);
    private readonly api = inject(Api);
    protected readonly stats = signal<Stat[]>([]);
    protected readonly champions = signal<Champion[]>([]);
    protected readonly upcoming = signal<NextEp[]>([]);
    protected readonly loading = signal(true);

    constructor() {
        effect(() => {
            if (this.store.currentId()) void this.load();
        });
    }

    private async load() {
        this.loading.set(true);
        try {
            const [totals, reigns, planned, seasons] = await Promise.all([
                Promise.all(STAT_KEYS.map((k) => this.api.count(k))),
                this.api.all('title-reigns'),
                this.api.all('episodes', { status: 'PLANNED' }),
                this.api.all('seasons')
            ]);
            const seasonOf = new Map(seasons.map((s) => [s.id, s]));
            this.upcoming.set(
                planned
                    // meses anteriores ao início do universe não entram na fila do que jogar
                    .filter((e) => !beforeStart(e['month'], seasonOf.get(e['seasonId'])?.['startMonth']))
                    .sort((a, b) => (seasonOf.get(a['seasonId'])?.['number'] ?? 0) - (seasonOf.get(b['seasonId'])?.['number'] ?? 0) || compareEpisodes(a as never, b as never))
                    .slice(0, 4)
                    .map((e) => ({
                        id: e.id,
                        show: e['show']?.name ?? 'Episódio',
                        title: e['title'] ?? '',
                        when: `${gameDayName(e as never)} · ${MONTHS[e['month'] - 1]}${e['week'] ? ' · semana ' + e['week'] : ''}${e['night'] ? ' · Noite ' + e['night'] : ''}`,
                        season: RESOURCES['seasons'].label(seasonOf.get(e['seasonId']) ?? ({ id: '', number: '?' } as Entity)),
                        color: e['show']?.brand?.color ?? null
                    }))
            );
            this.stats.set(STAT_KEYS.map((key, i) => ({ key, total: totals[i], label: RESOURCES[key].plural, icon: RESOURCES[key].icon })));
            this.champions.set(
                reigns
                    .filter((r) => !r['endDate'])
                    .map((r: Entity) => ({
                        title: r['title']?.name ?? '—',
                        holders: (r['holders'] ?? []).map((h: Entity) => h['wrestler']?.name ?? h['team']?.name).join(' & ') || '—',
                        since: fmtDate(r['startDate'])
                    }))
                    .sort((a, b) => a.title.localeCompare(b.title))
            );
        } catch {
            /* erro exibido pelo interceptor */
        } finally {
            this.loading.set(false);
        }
    }
}
