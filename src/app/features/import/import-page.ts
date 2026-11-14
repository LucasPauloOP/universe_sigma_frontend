import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Api } from '../../core/api';
import { MONTHS } from '../../core/format';
import { Refs } from '../../core/refs';
import { confirmAction } from '../../shared/dialogs';
import { PageHeader } from '../../shared/page-header';

interface Options {
    createMissing: boolean;
    replaceRosters: boolean;
    activateWrestlers: boolean;
    deactivateOthers: boolean;
    importDivisions: boolean;
    importPles: boolean;
    deactivateUnlistedPles: boolean;
}

interface Report {
    brands: { brand: string; isActive: boolean; roster: number; add: number; remove: number; divisions: { name: string; count: number }[] }[];
    newWrestlers: { name: string; gender: 'M' | 'W'; contractType: string }[];
    newTeams: { name: string; members: string[] }[];
    activate: number;
    deactivate: number;
    ples: {
        create: { name: string; kind: string; ppvMonth: number; ppvWeek: number }[];
        update: { id: string; name: string; from: { month: number | null; week: number | null }; to: { month: number; week: number } }[];
        unlisted: { id: string; name: string }[];
    };
    fuzzy: { from: string; to: string }[];
    assumedMale: string[];
    skippedMissing: string[];
    ignored: string[];
    warnings: string[];
}

interface Result {
    wrestlersCreated: number;
    teamsCreated: number;
    linksAdded: number;
    linksRemoved: number;
    activated: number;
    deactivated: number;
    divisionsFilled: number;
    divisionsMissing: string[];
    plesCreated: number;
    plesUpdated: number;
    plesDeactivated: number;
}

interface Response {
    applied: boolean;
    report: Report;
    result?: Result;
}

const OPTION_LABELS: { key: keyof Options; label: string; hint: string }[] = [
    { key: 'createMissing', label: 'Criar o que a planilha cita e o universe não tem', hint: 'Lutadores e duplas novos (gênero deduzido pela coluna; confira a lista antes de importar).' },
    { key: 'replaceRosters', label: 'Trocar o roster de cada brand pelo da planilha', hint: 'Quem está no roster da brand mas não na planilha sai dessa brand (o lutador continua existindo).' },
    { key: 'activateWrestlers', label: 'Ativar no universe quem está nos rosters da planilha', hint: '' },
    { key: 'deactivateOthers', label: 'Desativar quem não está em nenhum roster da planilha', hint: 'Só quem pertence às brands da planilha.' },
    { key: 'importDivisions', label: 'Preencher as divisões (colocações)', hint: 'A fila de cada divisão passa a ser a da planilha, na mesma ordem. Cria as divisões padrão que faltarem.' },
    { key: 'importPles', label: 'Cadastrar e ajustar os PLEs (mês e semana)', hint: 'PLEs que já existem têm só o mês/semana ajustados; os que faltam são criados.' },
    { key: 'deactivateUnlistedPles', label: 'Desativar PLEs que não estão na planilha', hint: 'Atenção: apaga os episódios desses PLEs.' }
];

@Component({
    selector: 'app-import-page',
    imports: [FormsModule, RouterLink, ButtonModule, TagModule, ToggleSwitchModule, PageHeader],
    templateUrl: './import-page.html'
})
export class ImportPage {
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);
    private readonly toast = inject(MessageService);
    private readonly confirmSvc = inject(ConfirmationService);

    protected readonly optionLabels = OPTION_LABELS;
    protected readonly options = signal<Options>({
        createMissing: true,
        replaceRosters: true,
        activateWrestlers: true,
        deactivateOthers: false,
        importDivisions: true,
        importPles: true,
        deactivateUnlistedPles: false
    });
    protected readonly file = signal<File | null>(null);
    protected readonly busy = signal(false);
    protected readonly report = signal<Report | null>(null);
    protected readonly result = signal<Result | null>(null);
    protected readonly months = MONTHS;

    protected readonly women = computed(() => this.report()?.newWrestlers.filter((w) => w.gender === 'W').length ?? 0);

    protected pick(ev: Event) {
        const input = ev.target as HTMLInputElement;
        this.file.set(input.files?.[0] ?? null);
        input.value = '';
        this.report.set(null);
        this.result.set(null);
    }

    protected setOption(key: keyof Options, value: boolean) {
        this.options.update((o) => ({ ...o, [key]: value }));
        // a análise depende das opções: precisa analisar de novo
        this.report.set(null);
    }

    private form(): FormData {
        const body = new FormData();
        body.append('file', this.file()!);
        body.append('options', JSON.stringify(this.options()));
        return body;
    }

    protected async analyze() {
        if (!this.file()) return;
        this.busy.set(true);
        this.result.set(null);
        try {
            const res = await this.api.postForm<Response & { id: string }>('import/universe-sheet', this.form());
            this.report.set(res.report);
        } catch {
            this.report.set(null);
        } finally {
            this.busy.set(false);
        }
    }

    protected async apply() {
        const r = this.report();
        if (!r || !this.file()) return;
        const ok = await confirmAction(this.confirmSvc, {
            title: 'Importar planilha',
            message: this.summary(r),
            confirmLabel: 'Importar',
            danger: this.options().deactivateUnlistedPles || this.options().replaceRosters
        });
        if (!ok) return;
        this.busy.set(true);
        try {
            const res = await this.api.postForm<Response & { id: string }>('import/universe-sheet?apply=true', this.form());
            this.result.set(res.result ?? null);
            this.report.set(null);
            // lutadores, duplas, brands, shows e divisões mudaram: a memória de listas ficou velha
            this.refs.clear();
            this.toast.add({ severity: 'success', summary: 'Planilha importada', life: 4000 });
        } catch {
            /* erro exibido pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }

    private summary(r: Report): string {
        const parts: string[] = [];
        const added = r.brands.reduce((n, b) => n + b.add, 0);
        const removed = r.brands.reduce((n, b) => n + b.remove, 0);
        parts.push(`${added} lutadores entram e ${removed} saem dos rosters das brands`);
        if (r.newWrestlers.length || r.newTeams.length) parts.push(`${r.newWrestlers.length} lutadores e ${r.newTeams.length} duplas serão criados`);
        const ples = r.ples.create.length + r.ples.update.length;
        if (ples) parts.push(`${ples} PLEs criados/ajustados`);
        if (this.options().deactivateUnlistedPles && r.ples.unlisted.length) parts.push(`${r.ples.unlisted.length} PLEs desativados (episódios apagados)`);
        return parts.join('; ') + '.';
    }

    protected monthName(m: number | null) {
        return m ? MONTHS[m - 1] : '—';
    }

    protected contractLabel(t: string) {
        return t === 'LEGEND' ? 'Lenda' : t === 'MANAGER' ? 'Manager' : '';
    }
}
