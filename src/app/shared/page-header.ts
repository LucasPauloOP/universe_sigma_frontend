import { Component, input } from '@angular/core';

@Component({
    selector: 'app-page-header',
    template: `
        <div class="flex flex-wrap items-center gap-3 mb-4">
            <div class="min-w-0">
                <h1 class="text-2xl font-semibold m-0">{{ title() }}</h1>
                @if (subtitle()) {
                    <div class="text-muted-color text-sm mt-1">{{ subtitle() }}</div>
                }
            </div>
            <div class="flex-1"></div>
            <ng-content />
        </div>
    `
})
export class PageHeader {
    readonly title = input.required<string>();
    readonly subtitle = input('');
}
