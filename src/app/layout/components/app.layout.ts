import { Component, computed, effect, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppTopbar } from './app.topbar';
import { LayoutService } from '@/app/layout/service/layout.service';
import { AppConfigurator } from './app.configurator';
import { AppBreadcrumb } from './app.breadcrumb';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [AppTopbar, RouterModule, AppConfigurator, AppBreadcrumb, ToastModule, ConfirmDialogModule],
    template: `
        <div class="layout-wrapper" [class]="containerClass()">
            <div class="layout-content-wrapper">
                <div app-topbar></div>

                <div class="content-breadcrumb">
                    <div app-breadcrumb></div>
                </div>

                <div class="layout-content">
                    <router-outlet></router-outlet>
                </div>

                <div class="layout-mask"></div>
            </div>
            <app-configurator />
            <p-confirmdialog />
        </div>
    `,
})
export class AppLayout {
    layoutService = inject(LayoutService);

    private readonly blockedScrollEffect = effect(() => {
        const state = this.layoutService.layoutState();
        if (state.mobileMenuActive) {
            document.body.classList.add('blocked-scroll');
        } else {
            document.body.classList.remove('blocked-scroll');
        }
    });

    containerClass = computed(() => {
        const layoutConfig = this.layoutService.layoutConfig();
        const layoutState = this.layoutService.layoutState();

        return {
            'layout-light': !layoutConfig.darkTheme,
            'layout-dark': layoutConfig.darkTheme,
            'layout-overlay': layoutConfig.menuMode === 'overlay',
            'layout-static': layoutConfig.menuMode === 'static',
            'layout-slim': layoutConfig.menuMode === 'slim',
            'layout-slim-plus': layoutConfig.menuMode === 'slim-plus',
            'layout-horizontal': layoutConfig.menuMode === 'horizontal',
            'layout-reveal': layoutConfig.menuMode === 'reveal',
            'layout-drawer': layoutConfig.menuMode === 'drawer',
            'layout-static-inactive': layoutState.staticMenuDesktopInactive && layoutConfig.menuMode === 'static',
            'layout-overlay-active': layoutState.overlayMenuActive,
            'layout-mobile-active': layoutState.mobileMenuActive,
            'layout-sidebar-expanded': layoutState.sidebarExpanded,
            'layout-sidebar-anchored': layoutState.anchored
        };
    });
}
