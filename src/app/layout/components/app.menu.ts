import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppMenuitem } from './app.menuitem';
import { GROUPS, RESOURCES } from '@/app/core/resources';
import { UniverseStore } from '@/app/core/universe-store';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model(); track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `,
    host: {
        class: 'layout-menu-container'
    }
})
export class AppMenu {
    private readonly store = inject(UniverseStore);

    model = computed<any[]>(() => {
        const home = {
            label: 'Início',
            icon: 'pi pi-home',
            path: '/g/home',
            items: [
                ...(this.store.currentId() ? [{ label: 'Painel', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/dashboard'] }] : []),
                { label: 'Meus universes', icon: 'pi pi-fw pi-globe', routerLink: ['/universes'] }
            ]
        };
        if (!this.store.currentId()) return [home];
        const icons: Record<string, string> = { Roster: 'pi pi-users', Títulos: 'pi pi-trophy', Shows: 'pi pi-video', Torneios: 'pi pi-sitemap' };
        const groups = GROUPS.map((g) => ({
            label: g,
            icon: icons[g],
            path: '/g/' + g,
            items: [
                ...(g === 'Roster' ? [{ label: 'Divisões (ranking)', icon: 'pi pi-fw pi-list-check', routerLink: ['/divisions'] }] : []),
                ...(g === 'Títulos' ? [{ label: 'Estatísticas de reinados', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/stats/reigns'] }] : []),
                ...Object.values(RESOURCES)
                    .filter((r) => r.group === g)
                    .map((r) => ({ label: r.plural, icon: 'pi pi-fw pi-' + r.icon, routerLink: r.key === 'episodes' ? ['/episodes'] : ['/r', r.key] }))
            ]
        }));
        return [home, ...groups];
    });
}
