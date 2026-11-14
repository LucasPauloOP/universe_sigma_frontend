import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { startWith } from 'rxjs';
import { Activation, ACTIVATABLE } from '../../core/activation';
import { Api } from '../../core/api';
import { Entity } from '../../core/models';
import { Refs } from '../../core/refs';
import { RESOURCES, Resource, buildBody } from '../../core/resources';
import { ImageField } from '../../shared/image-field';

export interface ResourceFormData {
    res: Resource;
    entity?: Entity;
}

@Component({
    selector: 'app-resource-form',
    imports: [ReactiveFormsModule, ButtonModule, DatePickerModule, InputNumberModule, InputTextModule, MultiSelectModule, ProgressSpinnerModule, SelectModule, TextareaModule, ToggleSwitchModule, ImageField],
    template: `
        @if (!ready()) {
            <div class="flex justify-center p-8"><p-progress-spinner strokeWidth="4" [style]="{ width: '3rem', height: '3rem' }" /></div>
        } @else {
            <form [formGroup]="form" (ngSubmit)="save()">
                <div class="grid grid-cols-12 gap-4">
                    @for (f of visible(); track f.key) {
                        <div [class]="f.full || f.type === 'textarea' || f.type === 'image' || f.type === 'refMulti' ? 'col-span-12' : 'col-span-12 sm:col-span-6'">
                            @if (f.type === 'boolean') {
                                <div class="flex items-center gap-3 h-full">
                                    <p-toggleswitch [formControlName]="f.key" [inputId]="'f-' + f.key" />
                                    <label [for]="'f-' + f.key">{{ f.label }}</label>
                                </div>
                            } @else if (f.type === 'image') {
                                <label class="block font-medium mb-2">{{ f.label }}</label>
                                <app-image-field [control]="imageControl(f.key)" />
                            } @else {
                                <label [for]="'f-' + f.key" class="block font-medium mb-2">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
                                @switch (f.type) {
                                    @case ('text') {
                                        <input pInputText [id]="'f-' + f.key" [formControlName]="f.key" class="w-full" />
                                    }
                                    @case ('textarea') {
                                        <textarea pTextarea [id]="'f-' + f.key" rows="3" [formControlName]="f.key" class="w-full"></textarea>
                                    }
                                    @case ('number') {
                                        <p-inputnumber [inputId]="'f-' + f.key" [formControlName]="f.key" [min]="f.min ?? null" [max]="f.max ?? null" [useGrouping]="false" [showButtons]="true" fluid />
                                    }
                                    @case ('color') {
                                        <input type="color" [id]="'f-' + f.key" [formControlName]="f.key" class="block w-full h-10 rounded-md cursor-pointer bg-transparent" />
                                    }
                                    @case ('select') {
                                        <p-select [inputId]="'f-' + f.key" [formControlName]="f.key" [options]="f.options ?? []" optionLabel="label" optionValue="value" [showClear]="!f.required" placeholder="Selecione" appendTo="body" fluid />
                                    }
                                    @case ('date') {
                                        <p-datepicker [inputId]="'f-' + f.key" [formControlName]="f.key" dateFormat="dd/mm/yy" [showIcon]="true" [showButtonBar]="true" appendTo="body" fluid />
                                    }
                                    @case ('ref') {
                                        <p-select [inputId]="'f-' + f.key" [formControlName]="f.key" [options]="options(f.ref!, f.refWhere)" optionLabel="label" optionValue="value" [filter]="true" filterBy="label" [showClear]="!f.required" placeholder="Selecione" appendTo="body" fluid />
                                    }
                                    @case ('refMulti') {
                                        <p-multiselect [inputId]="'f-' + f.key" [formControlName]="f.key" [options]="options(f.ref!)" optionLabel="label" optionValue="value" [filter]="true" filterBy="label" display="chip" placeholder="Selecione" appendTo="body" [maxSelectedLabels]="50" fluid />
                                    }
                                }
                                @if (f.hint) {
                                    <small class="block mt-1 text-muted-color">{{ f.hint }}</small>
                                }
                            }
                        </div>
                    }
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <p-button type="button" label="Cancelar" severity="secondary" text (onClick)="ref.close()" />
                    <p-button type="submit" label="Salvar" icon="pi pi-check" [loading]="busy()" />
                </div>
            </form>
        }
    `
})
export class ResourceForm {
    protected readonly ref = inject(DynamicDialogRef);
    protected readonly data = inject(DynamicDialogConfig).data as ResourceFormData;
    private readonly api = inject(Api);
    private readonly refs = inject(Refs);
    private readonly activation = inject(Activation);

    protected readonly ready = signal(false);
    protected readonly busy = signal(false);
    protected readonly form = this.buildForm();
    private readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), { initialValue: this.form.value });
    protected readonly visible = computed(() => this.data.res.fields.filter((f) => !f.showIf || f.showIf(this.values() as Record<string, unknown>)));

    constructor() {
        const keys = this.data.res.fields.filter((f) => f.ref).map((f) => f.ref!);
        void this.refs.loadMany(keys).then(() => this.ready.set(true));
        if (!this.data.entity) this.setupAutofill();
    }

    /** Criação: escolher um ref preenche outros campos (sem pisar no que o usuário editou). */
    private setupAutofill() {
        for (const f of this.data.res.fields) {
            const autofill = f.autofill;
            if (!autofill) continue;
            let last: Record<string, unknown> = {};
            this.form.controls[f.key].valueChanges.subscribe((id) => {
                const next = autofill(id, (k, i) => this.refs.list(k).find((e) => e.id === i));
                for (const [key, value] of Object.entries(next)) {
                    const c = this.form.controls[key];
                    if (!c) continue;
                    const empty = c.value === null || c.value === '' || c.value === undefined;
                    if (empty || c.value === last[key]) c.setValue(value, { emitEvent: false });
                }
                last = next;
            });
        }
    }

    private buildForm() {
        const { res, entity } = this.data;
        const controls: Record<string, FormControl> = {};
        for (const f of res.fields) {
            let v: unknown = entity ? (f.fromEntity ? f.fromEntity(entity) : entity[f.key]) : (f.default ?? (f.type === 'refMulti' ? [] : null));
            if (v === undefined) v = null;
            if (f.type === 'text' || f.type === 'textarea') v ??= '';
            controls[f.key] = new FormControl(v, f.required ? Validators.required : []);
        }
        return new FormGroup(controls);
    }

    /** Opções {value, label} de um recurso referenciado. */
    protected options(key: string, where?: (e: Entity) => boolean): { value: string; label: string }[] {
        this.refs.version();
        const r = RESOURCES[key];
        return this.refs
            .list(key)
            .filter((e) => !where || where(e))
            .map((e) => ({ value: e.id, label: r?.label(e) ?? (e['name'] as string) }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    protected imageControl(key: string) {
        return this.form.controls[key] as FormControl<string | null>;
    }

    protected async save() {
        if (this.form.invalid) return this.form.markAllAsTouched();
        this.busy.set(true);
        const { res, entity } = this.data;
        try {
            const body = buildBody(res, this.form.getRawValue(), entity);
            // show/brand sendo desativado: avisa o que será apagado antes de salvar
            if (entity && ACTIVATABLE.includes(res.key) && entity['isActive'] !== false && body['isActive'] === false) {
                const extra = await this.activation.confirmDeactivation(res.key as 'shows' | 'brands', entity);
                if (extra === null) return;
                Object.assign(body, extra);
            }
            const saved = entity ? await this.api.put(`${res.key}/${entity.id}`, body) : await this.api.post(res.key, body);
            this.ref.close(saved);
        } catch {
            /* erro exibido pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }
}
