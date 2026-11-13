import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogService } from 'primeng/dynamicdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Api } from '../../core/api';
import { Activation, ACTIVATABLE } from '../../core/activation';
import { Entity } from '../../core/models';
import { Refs } from '../../core/refs';
import { Column, Field, RESOURCES, Resource, RowAction } from '../../core/resources';
import { UniverseStore } from '../../core/universe-store';
import { confirmAction, openDialog } from '../../shared/dialogs';
import { PageHeader } from '../../shared/page-header';
import { GenerateEpisodes } from './generate-episodes';
import { ResourceForm } from './resource-form';
import { TitleHistory, WrestlerRecord } from './stats-dialogs';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface FilterDef {
    field: Field;
    options: { value: unknown; label: string }[];
}

/** Linha já preparada para a tabela: texto exibido (c) e valor de ordenação (s) por coluna. */
interface Row {
    e: Entity;
    c: Record<string, string>;
    s: Record<string, string | number>;
    haystack: string;
}

@Component({
    selector: 'app-resource-list',
    imports: [FormsModule, ToggleSwitchModule, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, SelectModule, TableModule, TagModule, TooltipModule, PageHeader],
    templateUrl: './resource-list.html'
})
export class ResourceList {
    /** :resource da rota */
    readonly resource = input.required<string>();

    private readonly api = inject(Api);
    private readonly refs = inject(Refs);
    private readonly store = inject(UniverseStore);
    private readonly dialogs = inject(DialogService);
    private readonly confirmSvc = inject(ConfirmationService);
    private readonly toast = inject(MessageService);
    private readonly router = inject(Router);
    private readonly activation = inject(Activation);

    protected readonly res = computed<Resource>(() => RESOURCES[this.resource()]);
    protected readonly loading = signal(true);
    protected readonly items = signal<Entity[]>([]);
    protected readonly search = signal('');
    protected readonly filterValues = signal<Record<string, unknown>>({});

    /** Linhas com textos calculados (recalcula quando os nomes de referências chegam). */
    private readonly rows = computed<Row[]>(() => {
        this.refs.version();
        const res = this.res();
        const name = (ref: string, id: string | null) => this.refs.label(ref, id);
        return this.items().map((e) => {
            const c: Row['c'] = {};
            const s: Row['s'] = {};
            for (const col of res.columns) {
                const v = col.render ? col.render(e, name) : e[col.key];
                c[col.key] = v === null || v === undefined ? '' : String(v);
                const sv = col.sortValue ? col.sortValue(e) : c[col.key];
                s[col.key] = typeof sv === 'string' ? norm(sv) : sv;
            }
            return { e, c, s, haystack: norm([res.label(e), ...Object.values(c)].join(' ')) };
        });
    });

    protected readonly filtered = computed(() => {
        const q = norm(this.search().trim());
        const fv = Object.entries(this.filterValues()).filter(([, v]) => v !== null && v !== undefined);
        return this.rows().filter((r) => fv.every(([k, v]) => r.e[k] === v) && (!q || r.haystack.includes(q)));
    });

    protected readonly hasFilters = computed(() => !!this.search() || Object.values(this.filterValues()).some((v) => v !== null && v !== undefined));

    protected readonly filters = computed<FilterDef[]>(() => {
        this.refs.version();
        return (this.res().filters ?? [])
            .map((k) => this.res().fields.find((f) => f.key === k))
            .filter((f): f is Field => !!f)
            .map((field) => ({ field, options: this.optionsFor(field) }));
    });

    constructor() {
        effect(() => {
            this.resource();
            if (this.store.currentId()) untracked(() => void this.load());
        });
    }

    private optionsFor(f: Field): { value: unknown; label: string }[] {
        if (f.type === 'boolean')
            return [
                { value: true, label: 'Sim' },
                { value: false, label: 'Não' }
            ];
        if (f.type === 'select') return (f.options ?? []).map((o) => ({ value: o.value, label: o.label }));
        if (f.type === 'ref' && f.ref) {
            const r = RESOURCES[f.ref];
            return this.refs
                .list(f.ref)
                .map((e) => ({ value: e.id, label: r.label(e) }))
                .sort((a, b) => a.label.localeCompare(b.label));
        }
        return [];
    }

    private async load() {
        this.loading.set(true);
        this.filterValues.set({});
        this.search.set('');
        const res = this.res();
        try {
            const refKeys = (res.filters ?? [])
                .map((k) => res.fields.find((f) => f.key === k))
                .filter((f) => f?.type === 'ref')
                .map((f) => f!.ref!);
            // o nome da temporada aparece na lista de episódios
            if (res.key === 'episodes') refKeys.push('seasons');
            const [rows] = await Promise.all([this.api.all(res.key), this.refs.loadMany(refKeys)]);
            this.items.set(rows);
        } catch {
            this.items.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    protected setFilter(key: string, v: unknown) {
        this.filterValues.update((f) => ({ ...f, [key]: v }));
    }

    protected clearFilters() {
        this.filterValues.set({});
        this.search.set('');
    }

    protected chips(c: Column, row: Row): string[] {
        return row.c[c.key].split('|').filter(Boolean);
    }

    protected async add() {
        await this.openForm();
    }

    protected async edit(e: Entity) {
        await this.openForm(e);
    }

    private async openForm(entity?: Entity) {
        const res = this.res();
        const saved = await openDialog(this.dialogs, ResourceForm, `${entity ? 'Editar' : 'Novo(a)'} ${res.singular.toLowerCase()}`, { res, entity }, '44rem');
        if (!saved) return;
        this.refs.invalidate(res.key);
        this.toast.add({ severity: 'success', summary: 'Salvo', life: 2500 });
        await this.load();
    }

    protected async remove(e: Entity) {
        const res = this.res();
        const ok = await confirmAction(this.confirmSvc, {
            title: `Excluir ${res.singular.toLowerCase()}`,
            message: `Excluir "${res.label(e)}"? Registros ligados a ele podem ser afetados.`,
            confirmLabel: 'Excluir',
            danger: true
        });
        if (!ok) return;
        await this.api.delete(`${res.key}/${e.id}`).catch(() => null);
        this.refs.invalidate(res.key);
        await this.load();
    }

    protected runAction(a: RowAction, e: Entity) {
        if (a.link) void this.router.navigate(a.link(e));
        else if (a.special === 'wrestlerRecord') void openDialog(this.dialogs, WrestlerRecord, `Retrospecto — ${e['name']}`, e, '30rem');
        else if (a.special === 'titleHistory') void openDialog(this.dialogs, TitleHistory, `Histórico — ${e['name']}`, e, '44rem');
    }

    /** Liga/desliga show ou brand direto da lista (desativar pede confirmação e apaga episódios). */
    protected async toggleActive(e: Entity, active: boolean) {
        const key = this.res().key;
        if (!ACTIVATABLE.includes(key)) return;
        const changed = await this.activation.setActive(key as 'shows' | 'brands', e, active);
        if (changed) {
            this.refs.invalidate(key);
            // desativar brand mexe nos shows (e nos episódios)
            if (key === 'brands') this.refs.invalidate('shows');
            this.toast.add({ severity: 'success', summary: active ? 'Ativado' : 'Desativado', life: 2500 });
        }
        await this.load(); // recarrega também quando cancelado (volta o switch)
    }

    protected async generate() {
        const created = await openDialog<number>(this.dialogs, GenerateEpisodes, 'Gerar episódios', undefined, '32rem');
        if (created === undefined) return;
        this.toast.add({ severity: created ? 'success' : 'info', summary: created ? `${created} episódio(s) criado(s)` : 'Nenhum episódio novo: tudo já existia', life: 4000 });
        await this.load();
    }
}
