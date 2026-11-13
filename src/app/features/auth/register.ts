import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Auth } from '../../core/auth';
import { AuthShell } from './auth-shell';

@Component({
    selector: 'app-register',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, ToggleSwitchModule, AuthShell],
    template: `
        <app-auth-shell title="Criar conta" subtitle="Você já começa com um universe pronto.">
            <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
                <div>
                    <label for="name" class="block font-medium mb-2">Nome</label>
                    <input pInputText id="name" formControlName="name" autocomplete="name" class="w-full" />
                </div>
                <div>
                    <label for="email" class="block font-medium mb-2">E-mail *</label>
                    <input pInputText id="email" type="email" formControlName="email" autocomplete="email" class="w-full" />
                    @if (form.controls.email.invalid && form.controls.email.touched) {
                        <small class="text-red-500">Informe um e-mail válido.</small>
                    }
                </div>
                <div>
                    <label for="password" class="block font-medium mb-2">Senha *</label>
                    <p-password inputId="password" formControlName="password" [toggleMask]="true" [feedback]="false" autocomplete="new-password" fluid />
                    <small [class]="form.controls.password.invalid && form.controls.password.touched ? 'text-red-500' : 'text-muted-color'">De 8 a 100 caracteres.</small>
                </div>
                <div class="flex items-center gap-3">
                    <p-toggleswitch formControlName="useTemplate" inputId="tpl" />
                    <label for="tpl">Começar com o elenco e os títulos padrão</label>
                </div>
                <p-button type="submit" label="Cadastrar" [loading]="busy()" fluid />
            </form>
            <p class="text-sm text-muted-color mt-6">
                Já tem conta?
                <a routerLink="/login" class="text-primary font-medium">Entrar</a>
            </p>
        </app-auth-shell>
    `
})
export class Register {
    private readonly auth = inject(Auth);
    private readonly router = inject(Router);
    protected readonly busy = signal(false);
    protected readonly form = inject(FormBuilder).nonNullable.group({
        name: [''],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
        useTemplate: [true]
    });

    protected async submit() {
        if (this.form.invalid) return this.form.markAllAsTouched();
        this.busy.set(true);
        try {
            const { name, ...rest } = this.form.getRawValue();
            await this.auth.register({ ...rest, ...(name.trim() ? { name: name.trim() } : {}) });
            await this.router.navigate(['/']);
        } catch {
            /* mensagem exibida pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
