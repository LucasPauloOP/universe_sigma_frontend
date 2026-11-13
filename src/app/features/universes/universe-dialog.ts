import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Universe } from '../../core/models';

@Component({
    selector: 'app-universe-dialog',
    imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule, ToggleSwitchModule],
    template: `
        <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-4">
            <div>
                <label for="name" class="block font-medium mb-2">Nome *</label>
                <input pInputText id="name" formControlName="name" maxlength="100" class="w-full" />
            </div>
            <div>
                <label for="desc" class="block font-medium mb-2">Descrição</label>
                <textarea pTextarea id="desc" rows="3" formControlName="description" maxlength="500" class="w-full"></textarea>
            </div>
            @if (!data) {
                <div class="flex items-center gap-3">
                    <p-toggleswitch formControlName="useTemplate" inputId="tpl" />
                    <label for="tpl">Começar com elenco e títulos padrão</label>
                </div>
            }
            <div class="flex justify-end gap-2 mt-2">
                <p-button type="button" label="Cancelar" severity="secondary" text (onClick)="ref.close()" />
                <p-button type="submit" label="Salvar" [disabled]="form.invalid" />
            </div>
        </form>
    `
})
export class UniverseDialog {
    protected readonly ref = inject(DynamicDialogRef);
    protected readonly data = inject(DynamicDialogConfig<Universe | null>).data as Universe | null;
    protected readonly form = inject(FormBuilder).nonNullable.group({
        name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(100)]],
        description: [this.data?.description ?? ''],
        useTemplate: [true]
    });

    protected save() {
        if (this.form.invalid) return;
        const { name, description, useTemplate } = this.form.getRawValue();
        this.ref.close(this.data ? { name: name.trim(), description: description.trim() || null } : { name: name.trim(), description: description.trim() || undefined, useTemplate });
    }
}
