import { Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { StyleClassModule } from 'primeng/styleclass';
import { ButtonModule } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { LayoutService } from '@/app/layout/service/layout.service';
import { AppSidebar } from '@/app/layout/components/app.sidebar';
import { AppBreadcrumb } from '@/app/layout/components/app.breadcrumb';
import { Auth } from '@/app/core/auth';
import { UniverseStore } from '@/app/core/universe-store';

@Component({
    selector: '[app-topbar]',
    standalone: true,
    imports: [RouterModule, StyleClassModule, Ripple, ButtonModule, Menu, AppBreadcrumb, AppSidebar],
    template: `
        <div class="topbar-start">
            <button pButton pRipple #menubutton type="button" class="topbar-menubutton p-trigger" text rounded severity="secondary" (click)="onMenuButtonClick()">
                <i class="pi pi-bars"></i>
            </button>

            <div class="topbar-breadcrumb">
                <div app-breadcrumb></div>
            </div>
        </div>
        <div class="layout-topbar-menu-section">
            <div app-sidebar></div>
        </div>
        <div class="topbar-end">
            <ul class="topbar-menu">
                <li>
                    <button pButton pRipple type="button" severity="secondary" text (click)="universeMenu.toggle($event)" class="max-w-48 sm:max-w-72">
                        <i class="pi pi-globe"></i>
                        <span class="truncate">{{ store.current()?.name ?? 'Selecione um universe' }}</span>
                        <i class="pi pi-angle-down"></i>
                    </button>
                    <p-menu #universeMenu [model]="universeItems()" [popup]="true" appendTo="body" />
                </li>

                <li class="ml-4">
                    <button pButton iconOnly pRipple type="button" class="shrink-0 config-button" text rounded (click)="onConfigButtonClick()" aria-label="Tema"><i class="pi pi-palette"></i></button>
                </li>

                <li class="profile-item topbar-item">
                    <button pButton iconOnly pRipple type="button" rounded severity="secondary" (click)="userMenu.toggle($event)" [attr.aria-label]="'Conta'">
                        <span class="font-semibold">{{ initial() }}</span>
                    </button>
                    <p-menu #userMenu [model]="userItems()" [popup]="true" appendTo="body" />
                </li>
            </ul>
        </div>
    `,
    host: {
        class: 'layout-topbar'
    }
})
export class AppTopbar {
    menuButton = viewChild.required<ElementRef<HTMLElement>>('menubutton');
    appSidebar = viewChild.required(AppSidebar);

    el = inject(ElementRef);
    public layoutService = inject(LayoutService);
    protected readonly store = inject(UniverseStore);
    private readonly auth = inject(Auth);
    private readonly router = inject(Router);

    initial = computed(() => (this.auth.user()?.name || this.auth.user()?.email || '?').charAt(0).toUpperCase());

    universeItems = computed<MenuItem[]>(() => [
        ...this.store.universes().map((u) => ({
            label: u.name,
            icon: u.id === this.store.currentId() ? 'pi pi-check-circle' : 'pi pi-circle',
            command: () => this.switchUniverse(u.id)
        })),
        { separator: true },
        { label: 'Gerenciar universes', icon: 'pi pi-cog', command: () => this.router.navigate(['/universes']) }
    ]);

    userItems = computed<MenuItem[]>(() => [
        { label: this.auth.user()?.name || 'Usuário', disabled: true, styleClass: 'font-semibold' },
        { label: this.auth.user()?.email ?? '', disabled: true },
        { separator: true },
        { label: 'Sair', icon: 'pi pi-sign-out', command: () => this.auth.logout() }
    ]);

    private switchUniverse(id: string) {
        if (id === this.store.currentId()) return;
        this.store.select(id);
        void this.router.navigateByUrl('/dashboard');
    }

    onMenuButtonClick() {
        this.layoutService.onMenuToggle();
    }

    onConfigButtonClick() {
        this.layoutService.showConfigSidebar();
    }
}
