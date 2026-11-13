import { Component, inject, input } from '@angular/core';
import { LayoutService } from '@/app/layout/service/layout.service';
import { AppConfigurator } from '@/app/layout/components/app.configurator';

/** Moldura das telas de login/cadastro (mesmo visual do Atlantis). */
@Component({
    selector: 'app-auth-shell',
    imports: [AppConfigurator],
    template: `
        <div [class]="'flex min-h-screen ' + (layoutService.isDarkTheme() ? 'layout-dark' : 'layout-light')">
            <div class="w-full flex items-center justify-center p-6" style="background: var(--surface-ground)">
                <div class="w-full max-w-sm">
                    <div class="flex items-center gap-3 mb-8">
                        <i class="pi pi-globe text-primary text-4xl"></i>
                        <span class="text-2xl font-semibold">Universe Sigma</span>
                    </div>
                    <h1 class="text-xl font-semibold m-0">{{ title() }}</h1>
                    <p class="text-muted-color mt-1 mb-6">{{ subtitle() }}</p>
                    <ng-content />
                </div>
            </div>
        </div>
        <app-configurator [simple]="true" />
    `
})
export class AuthShell {
    layoutService = inject(LayoutService);
    title = input('');
    subtitle = input('');
}
