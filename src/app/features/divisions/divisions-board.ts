import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Api } from '../../core/api';
import { fmtDate } from '../../core/format';
import { CardDivision, DivisionEntry } from '../../core/models';
import { Refs } from '../../core/refs';
import { UniverseStore } from '../../core/universe-store';
import { PageHeader } from '../../shared/page-header';

const entryKey = (e: { wrestlerId?: string | null; teamId?: string | null }) => (e.wrestlerId ? `w:${e.wrestlerId}` : `t:${e.teamId}`);

@Component({
    selector: 'app-divisions-board',
    imports: [DragDropModule, FormsModule, RouterLink, ButtonModule, ProgressBarModule, SelectModule, TagModule, TooltipModule, PageHeader],
    templateUrl: './divisions-board.html'
})
export class DivisionsBoard {
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);
    private readonly store = inject(UniverseStore);
    private readonly toast = inject(MessageService);

    protected readonly loading = signal(true);
    protected readonly divisions = signal<CardDivision[]>([]);
    protected readonly brandId = signal<string | null>(null);
    protected readonly saving = signal(false);
    protected readonly fmt = fmtDate;

    protected readonly brandOptions = computed(() => {
        const brands = this.divisions().flatMap((d) => (d.brand ? [{ value: d.brand.id, label: d.brand['name'] as string }] : []));
        const unique = [...new Map(brands.map((b) => [b.value, b])).values()];
        return this.divisions().some((d) => !d.brand) ? [...unique, { value: '_none', label: 'Sem brand' }] : unique;
    });

    /** Divisões da brand escolhida, lado a lado como na planilha. */
    protected readonly visible = computed(() => {
        const id = this.brandId();
        return this.divisions().filter((d) => (id === '_none' ? !d.brand : d.brandId === id) && d['isActive'] !== false);
    });

    constructor() {
        effect(() => {
            if (this.store.currentId()) untracked(() => void this.load());
        });
    }

    private async load() {
        this.loading.set(true);
        try {
            const [divs] = await Promise.all([this.api.get<CardDivision[]>('card-divisions/board'), this.refs.loadMany(['wrestlers', 'teams'])]);
            this.divisions.set(divs);
            const ids = this.brandOptions().map((o) => o.value);
            if (!this.brandId() || !ids.includes(this.brandId()!)) this.brandId.set(ids[0] ?? null);
        } catch {
            this.divisions.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    protected champion(d: CardDivision): string {
        return d.champions.map((c) => c.name).join(' & ');
    }

    protected isChampion(d: CardDivision, e: DivisionEntry): boolean {
        return d.champions.some((c) => (c.wrestlerId && c.wrestlerId === e.wrestlerId) || (c.teamId && c.teamId === e.teamId));
    }

    protected nameOf(e: DivisionEntry): string {
        return e.wrestler?.name ?? e.team?.['name'] ?? '?';
    }

    /** Lutadores e duplas que ainda não estão nesta divisão. */
    protected pickerOptions(d: CardDivision) {
        this.refs.version();
        const used = new Set(d.entries.map(entryKey));
        const toOpt = (prefix: 'w' | 't') => (x: { id: string; [k: string]: any }) => ({ value: `${prefix}:${x.id}`, label: x['name'] as string });
        const w = this.refs.list('wrestlers').map(toOpt('w'));
        const t = this.refs.list('teams').map(toOpt('t'));
        const free = (l: { value: string; label: string }[]) => l.filter((o) => !used.has(o.value)).sort((a, b) => a.label.localeCompare(b.label));
        const groups = [
            { label: 'Duplas e facções', items: free(t) },
            { label: 'Lutadores', items: free(w) }
        ];
        // divisão de título de duplas: duplas primeiro
        return d.title?.['isTag'] ? groups : [...groups].reverse();
    }

    private async save(d: CardDivision, keys: string[]) {
        this.saving.set(true);
        const entries = keys.map((k) => (k.startsWith('w:') ? { wrestlerId: k.slice(2) } : { teamId: k.slice(2) }));
        try {
            const updated = await this.api.put<CardDivision>(`card-divisions/${d.id}/entries`, { entries });
            this.divisions.update((list) => list.map((x) => (x.id === d.id ? updated : x)));
        } catch {
            await this.load(); // volta ao estado do servidor
        } finally {
            this.saving.set(false);
        }
    }

    protected async drop(d: CardDivision, ev: CdkDragDrop<DivisionEntry[]>) {
        if (ev.previousIndex === ev.currentIndex) return;
        const entries = [...d.entries];
        moveItemInArray(entries, ev.previousIndex, ev.currentIndex);
        this.divisions.update((list) => list.map((x) => (x.id === d.id ? { ...x, entries } : x)));
        await this.save(d, entries.map(entryKey));
    }

    protected async add(d: CardDivision, key: string | null) {
        if (!key) return;
        await this.save(d, [...d.entries.map(entryKey), key]);
    }

    protected async remove(d: CardDivision, e: DivisionEntry) {
        await this.save(d, d.entries.filter((x) => x.id !== e.id).map(entryKey));
    }

    /** Sobe o lutador direto para a 1ª posição (próximo desafiante). */
    protected async toTop(d: CardDivision, e: DivisionEntry) {
        const k = entryKey(e);
        await this.save(d, [k, ...d.entries.map(entryKey).filter((x) => x !== k)]);
    }

    protected async createDefaults() {
        try {
            const res = await this.api.post<{ created: number }>('card-divisions/defaults');
            this.toast.add({
                severity: res.created ? 'success' : 'info',
                summary: res.created ? `${res.created} divisões criadas` : 'Nada a criar: as brands RAW e SmackDown já têm divisões',
                life: 4000
            });
            await this.load();
        } catch {
            /* erro exibido pelo interceptor */
        }
    }
}
