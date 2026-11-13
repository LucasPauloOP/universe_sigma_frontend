import { Component, inject, input, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Api } from '../core/api';

/**
 * Upload de imagem. O controle guarda o `imageUrl` a salvar ("storage:..."),
 * ou a URL assinada atual (inalterada) ao editar.
 */
@Component({
    selector: 'app-image-field',
    imports: [ButtonModule],
    template: `
        <div class="flex items-center gap-4">
            <div class="w-24 h-24 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-surface-100 dark:bg-surface-800 text-surface-500">
                @if (preview()) {
                    <img [src]="preview()" alt="Pré-visualização" class="w-full h-full object-cover" />
                } @else {
                    <i class="pi pi-image text-3xl"></i>
                }
            </div>
            <div class="flex flex-col gap-2">
                <div class="flex gap-2">
                    <p-button label="Enviar imagem" icon="pi pi-upload" severity="secondary" size="small" [loading]="busy()" (onClick)="file.click()" />
                    @if (preview()) {
                        <p-button label="Remover" icon="pi pi-times" severity="secondary" text size="small" (onClick)="clear()" />
                    }
                </div>
                <small class="text-muted-color">JPEG, PNG, WebP ou GIF até 5 MB</small>
            </div>
            <input #file type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" (change)="pick($event)" />
        </div>
    `
})
export class ImageField {
    private readonly api = inject(Api);
    readonly control = input.required<FormControl<string | null>>();
    protected readonly busy = signal(false);
    /** URL assinada da imagem recém-enviada (o valor do controle é só a chave). */
    private readonly uploaded = signal<string | null>(null);

    protected preview(): string | null {
        const v = this.control().value;
        if (!v) return null;
        return this.uploaded() ?? (v.startsWith('storage:') ? null : v);
    }

    protected async pick(ev: Event) {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        this.busy.set(true);
        try {
            const res = await this.api.upload(file);
            this.uploaded.set(res.url);
            this.control().setValue(res.imageUrl);
            this.control().markAsDirty();
        } catch {
            /* erro exibido pelo interceptor */
        } finally {
            this.busy.set(false);
        }
    }

    protected clear() {
        this.uploaded.set(null);
        this.control().setValue(null);
        this.control().markAsDirty();
    }
}
