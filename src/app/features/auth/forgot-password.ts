import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { Auth } from '../../core/auth';
import { AuthShell } from './auth-shell';

/** Recuperação de senha sem e-mail (temporário): confirma o e-mail e define a nova senha. */
@Component({
    selector: 'app-forgot-password',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, PasswordModule, AuthShell],
    template: `
        <app-auth-shell title="Esqueci a senha" [subtitle]="confirmed() ? 'Defina a nova senha.' : 'Informe o e-mail da sua conta.'">
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
                @if (confirmed()) {
                    <div>
                        <label for="password" class="block font-medium mb-2">Nova senha</label>
                        <p-password inputId="password" formControlName="password" [feedback]="false" [toggleMask]="true" autocomplete="new-password" fluid />
                        @if (form.controls.password.invalid && form.controls.password.touched) {
                            <small class="text-red-500">A senha precisa ter ao menos 8 caracteres.</small>
                        }
                    </div>
                    <div>
                        <label for="confirm" class="block font-medium mb-2">Confirmar senha</label>
                        <p-password inputId="confirm" formControlName="confirm" [feedback]="false" [toggleMask]="true" autocomplete="new-password" fluid />
                        @if (form.controls.confirm.touched && form.controls.confirm.value !== form.controls.password.value) {
                            <small class="text-red-500">As senhas não conferem.</small>
                        }
                    </div>
                }
                <p-button type="submit" [label]="confirmed() ? 'Trocar senha' : 'Continuar'" [loading]="busy()" fluid />
            </form>
            <p class="text-sm text-muted-color mt-6">
                <a routerLink="/login" class="text-primary font-medium">Voltar ao login</a>
            </p>
        </app-auth-shell>
    `
})
export class ForgotPassword {
    private readonly auth = inject(Auth);
    private readonly router = inject(Router);
    private readonly toast = inject(MessageService);
    protected readonly busy = signal(false);
    protected readonly confirmed = signal(false);
    protected readonly form = inject(FormBuilder).nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        password: [''],
        confirm: ['']
    });

    protected async submit() {
        const { email, password, confirm } = this.form.getRawValue();
        if (this.form.controls.email.invalid) return this.form.controls.email.markAsTouched();
        if (!this.confirmed()) {
            await this.run(async () => {
                await this.auth.checkEmail(email);
                this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
                this.form.controls.password.updateValueAndValidity();
                this.confirmed.set(true);
            });
            return;
        }
        this.form.markAllAsTouched();
        if (this.form.invalid || password !== confirm) return;
        await this.run(async () => {
            await this.auth.resetPassword(email, password);
            this.toast.add({ severity: 'success', summary: 'Senha alterada', detail: 'Entre com a nova senha.', life: 5000 });
            await this.router.navigate(['/login']);
        });
    }

    private async run(fn: () => Promise<void>) {
        this.busy.set(true);
        try {
            await fn();
        } catch {
            /* mensagem exibida pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
