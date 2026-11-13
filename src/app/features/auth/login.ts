import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { Auth } from '../../core/auth';
import { UniverseStore } from '../../core/universe-store';
import { AuthShell } from './auth-shell';

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, PasswordModule, AuthShell],
    template: `
        <app-auth-shell title="Entrar" subtitle="Acesse para gerenciar seu universe.">
            <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
                <div>
                    <label for="email" class="block font-medium mb-2">E-mail</label>
                    <p-iconfield>
                        <p-inputicon class="pi pi-envelope" />
                        <input pInputText id="email" type="email" formControlName="email" autocomplete="email" class="w-full" />
                    </p-iconfield>
                    @if (form.controls.email.invalid && form.controls.email.touched) {
                        <small class="text-red-500">Informe um e-mail válido.</small>
                    }
                </div>
                <div>
                    <label for="password" class="block font-medium mb-2">Senha</label>
                    <p-password inputId="password" formControlName="password" [feedback]="false" [toggleMask]="true" autocomplete="current-password" fluid />
                    @if (form.controls.password.invalid && form.controls.password.touched) {
                        <small class="text-red-500">Informe a senha.</small>
                    }
                </div>
                <p-button type="submit" label="Entrar" [loading]="busy()" fluid />
            </form>
            <p class="text-sm text-muted-color mt-6">
                Não tem conta?
                <a routerLink="/register" class="text-primary font-medium">Cadastre-se</a>
            </p>
        </app-auth-shell>
    `
})
export class Login {
    private readonly auth = inject(Auth);
    private readonly router = inject(Router);
    private readonly store = inject(UniverseStore);
    protected readonly busy = signal(false);
    protected readonly form = inject(FormBuilder).nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required]
    });

    protected async submit() {
        if (this.form.invalid) return this.form.markAllAsTouched();
        this.busy.set(true);
        try {
            const { email, password } = this.form.getRawValue();
            await this.auth.login(email, password);
            await this.router.navigate([this.store.currentId() ? '/' : '/universes']);
        } catch {
            /* mensagem exibida pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
