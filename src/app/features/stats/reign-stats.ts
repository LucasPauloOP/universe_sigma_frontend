import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { Api } from '../../core/api';
import { fmtDate } from '../../core/format';
import { HolderStat, TitleStats } from '../../core/models';
import { UniverseStore } from '../../core/universe-store';
import { PageHeader } from '../../shared/page-header';

/** Total por lutador somando todos os títulos. */
interface Overall {
    key: string;
    name: string;
    reigns: number;
    days: number;
    titles: { title: string; reigns: number; days: number; current: boolean }[];
}

@Component({
    selector: 'app-reign-stats',
    imports: [FormsModule, RouterLink, ButtonModule, ChartModule, ProgressBarModule, SelectModule, SelectButtonModule, TagModule, PageHeader],
    templateUrl: './reign-stats.html'
})
export class ReignStats {
    private readonly api = inject(Api);
    private readonly store = inject(UniverseStore);

    protected readonly data = signal<TitleStats | null>(null);
    protected readonly loading = signal(true);
    protected readonly view = signal<'title' | 'wrestler'>('title');
    protected readonly viewOptions = [
        { label: 'Por título', value: 'title' },
        { label: 'Por lutador', value: 'wrestler' }
    ];
    protected readonly selectedTitle = signal<string | null>(null);
    protected readonly expanded = signal<Set<string>>(new Set());
    protected readonly fmt = fmtDate;

    protected readonly titleOptions = computed(() => (this.data()?.titles ?? []).map((t) => ({ value: t.title.id, label: t.title['name'] as string })));

    protected readonly current = computed(() => {
        const d = this.data();
        if (!d) return null;
        return d.titles.find((t) => t.title.id === this.selectedTitle()) ?? d.titles[0] ?? null;
    });

    protected readonly overall = computed<Overall[]>(() => {
        const map = new Map<string, Overall>();
        for (const t of this.data()?.titles ?? []) {
            for (const h of t.holders) {
                let o = map.get(h.key);
                if (!o) map.set(h.key, (o = { key: h.key, name: h.name, reigns: 0, days: 0, titles: [] }));
                o.reigns += h.reigns;
                o.days += h.days;
                o.titles.push({ title: t.title['name'], reigns: h.reigns, days: h.days, current: h.isCurrent });
            }
        }
        return [...map.values()].sort((a, b) => b.days - a.days || b.reigns - a.reigns);
    });

    /** Destaques gerais. */
    protected readonly highlights = computed(() => {
        const all = this.overall();
        if (!all.length) return [];
        const mostReigns = [...all].sort((a, b) => b.reigns - a.reigns)[0];
        const mostDays = all[0];
        const reigning = (this.data()?.titles ?? []).flatMap((t) => t.holders.filter((h) => h.isCurrent).map((h) => ({ h, title: t.title['name'] as string })));
        const longestNow = reigning.sort((a, b) => b.h.days - a.h.days)[0];
        return [
            { icon: 'pi-hashtag', label: 'Mais reinados', value: mostReigns.name, detail: `${mostReigns.reigns}x campeão` },
            { icon: 'pi-clock', label: 'Mais dias com cinturões', value: mostDays.name, detail: `${mostDays.days.toLocaleString('pt-BR')} dias` },
            ...(longestNow ? [{ icon: 'pi-trophy', label: 'Campeão há mais tempo', value: longestNow.h.name, detail: `${longestNow.title} · ${longestNow.h.days.toLocaleString('pt-BR')} dias` }] : [])
        ];
    });

    protected readonly chartData = computed(() => {
        const rows = (this.current()?.holders ?? []).slice(0, 10);
        const css = getComputedStyle(document.documentElement);
        const color = css.getPropertyValue('--p-primary-500').trim() || '#10b981';
        return {
            labels: rows.map((h) => h.name),
            datasets: [
                { label: 'Dias com o cinturão', data: rows.map((h) => h.days), backgroundColor: color, borderRadius: 6 }
            ]
        };
    });

    protected readonly chartOptions = {
        indexAxis: 'y' as const,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
    };

    constructor() {
        effect(() => {
            if (this.store.currentId()) void this.load();
        });
    }

    private async load() {
        this.loading.set(true);
        try {
            this.data.set(await this.api.get<TitleStats>('stats/titles'));
            this.selectedTitle.set(null);
        } catch {
            this.data.set(null);
        } finally {
            this.loading.set(false);
        }
    }

    protected toggle(key: string) {
        this.expanded.update((s) => {
            const n = new Set(s);
            if (n.has(key)) n.delete(key);
            else n.add(key);
            return n;
        });
    }

    protected isOpen(key: string) {
        return this.expanded().has(key);
    }

    protected chartHeight() {
        return Math.max(160, (this.current()?.holders.slice(0, 10).length ?? 0) * 36 + 40) + 'px';
    }

    protected hasDetail(h: HolderStat) {
        return h.reignList.length > 0 || h.baselineReigns > 0;
    }
}
