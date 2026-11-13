import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { GlobalLoader } from './shared/global-loader';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule, ToastModule, GlobalLoader],
    template: `<app-global-loader /><router-outlet></router-outlet><p-toast position="top-right" />`
})
export class AppComponent {}
