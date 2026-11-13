import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogService } from 'primeng/dynamicdialog';
import { MenuModule } from 'primeng/menu';
import { TagModule } from 'primeng/tag';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../../core/api';
import { Auth } from '../../core/auth';
import { Universe } from '../../core/models';
import { Refs } from '../../core/refs';
import { UniverseStore } from '../../core/universe-store';
import { confirmAction, openDialog } from '../../shared/dialogs';
import { PageHeader } from '../../shared/page-header';
import { UniverseDialog } from './universe-dialog';

@Component({
    selector: 'app-universes',
    imports: [DatePipe, ButtonModule, MenuModule, TagModule, PageHeader],
    template: `
        <app-page-header title="Meus universes" subtitle="Cada universe é um save independente do jogo.">
            <p-button label="Novo universe" icon="pi pi-plus" (onClick)="create()" />
        </app-page-header>

        <div class="grid grid-cols-12 gap-4">
            @for (u of store.universes(); track u.id) {
                <div class="col-span-12 md:col-span-6 xl:col-span-4">
                    <div class="card h-full flex flex-col gap-3" [class.outline-2]="u.id === store.currentId()" [class.outline]="u.id === store.currentId()" [class.outline-primary]="u.id === store.currentId()">
                        <div class="flex items-start gap-2">
                            <div class="min-w-0 flex-1">
                                <div class="text-xl font-semibold truncate">{{ u.name }}</div>
                                <div class="text-sm text-muted-color">Criado em {{ u.createdAt | date: 'dd/MM/yyyy' }}</div>
                            </div>
                            @if (u.id === store.currentId()) {
                                <p-tag value="Em uso" />
                            }
                            <p-button icon="pi pi-ellipsis-v" severity="secondary" text rounded (onClick)="menu.toggle($event); target = u" aria-label="Mais ações" />
                        </div>
                        <p class="text-muted-color m-0 flex-1">{{ u.description || 'Sem descrição' }}</p>
                        <div>
                            <p-button [label]="u.id === store.currentId() ? 'Abrir painel' : 'Usar este'" [outlined]="u.id !== store.currentId()" size="small" (onClick)="open(u)" />
                        </div>
                    </div>
                </div>
            } @empty {
                <p class="col-span-12 text-muted-color">Você ainda não tem nenhum universe. Crie o primeiro!</p>
            }
        </div>
        <p-menu #menu [model]="items" [popup]="true" appendTo="body" />
    `
})
export class Universes {
    protected readonly store = inject(UniverseStore);
    private readonly auth = inject(Auth);
    private readonly http = inject(HttpClient);
    private readonly dialogs = inject(DialogService);
    private readonly confirmSvc = inject(ConfirmationService);
    private readonly toast = inject(MessageService);
    private readonly router = inject(Router);
    private readonly refs = inject(Refs);

    protected target: Universe | null = null;
    protected readonly items: MenuItem[] = [
        { label: 'Editar', icon: 'pi pi-pencil', command: () => this.edit(this.target!) },
        { label: 'Restaurar padrão', icon: 'pi pi-refresh', command: () => this.reset(this.target!) },
        { label: 'Excluir', icon: 'pi pi-trash', styleClass: 'text-red-500', command: () => this.remove(this.target!) }
    ];

    protected open(u: Universe) {
        this.store.select(u.id);
        void this.router.navigate(['/dashboard']);
    }

    protected async create() {
        const body = await openDialog(this.dialogs, UniverseDialog, 'Novo universe', null, '28rem');
        if (!body) return;
        const created = await firstValueFrom(this.http.post<Universe>(`${API_BASE}/universes`, body));
        await this.auth.loadUniverses();
        this.store.select(created.id);
        this.toast.add({ severity: 'success', summary: 'Universe criado', life: 3000 });
    }

    protected async edit(u: Universe) {
        const body = await openDialog(this.dialogs, UniverseDialog, 'Editar universe', u, '28rem');
        if (!body) return;
        await firstValueFrom(this.http.put(`${API_BASE}/universes/${u.id}`, body));
        await this.auth.loadUniverses();
    }

    protected async reset(u: Universe) {
        const ok = await confirmAction(this.confirmSvc, {
            title: 'Restaurar padrão',
            message: `Isso APAGA todos os dados de "${u.name}" e recria o elenco, os títulos e os shows padrão. Não dá para desfazer.`,
            confirmLabel: 'Restaurar',
            danger: true
        });
        if (!ok) return;
        await firstValueFrom(this.http.post(`${API_BASE}/universes/${u.id}/reset`, { confirm: true }));
        // os registros foram recriados com ids novos: a memória de listas ficou velha
        this.refs.clear();
        this.toast.add({ severity: 'success', summary: 'Universe restaurado para o padrão', life: 3000 });
    }

    protected async remove(u: Universe) {
        const ok = await confirmAction(this.confirmSvc, {
            title: 'Excluir universe',
            message: `Excluir "${u.name}" e todos os seus dados? Não dá para desfazer.`,
            confirmLabel: 'Excluir',
            danger: true
        });
        if (!ok) return;
        await firstValueFrom(this.http.delete(`${API_BASE}/universes/${u.id}`));
        await this.auth.loadUniverses();
    }
}
