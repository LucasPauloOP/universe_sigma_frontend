import { Component, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

interface Breadcrumb {
    label: string;
}

@Component({
    selector: '[app-breadcrumb]',
    standalone: true,
    template: ` <nav>
        <ol class="relative z-20">
            @for (item of breadcrumbs(); track $index; let last = $last) {
                <li>{{ item.label }}</li>
                @if (!last) {
                    <li class="layout-breadcrumb-chevron">/</li>
                }
            }
        </ol>
    </nav>`,
    host: {
        class: 'layout-breadcrumb flex items-center relative h-12'
    }
})
export class AppBreadcrumb {
    private router = inject(Router);

    breadcrumbs = toSignal(
        this.router.events.pipe(
            filter((e) => e instanceof NavigationEnd),
            startWith(null),
            map(() => this.build())
        ),
        { initialValue: [] as Breadcrumb[] }
    );

    private build(): Breadcrumb[] {
        const out: Breadcrumb[] = [];
        let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
        while (route) {
            const label = route.data['breadcrumb'];
            if (label && out.at(-1)?.label !== label) out.push({ label });
            route = route.firstChild;
        }
        return out;
    }
}
