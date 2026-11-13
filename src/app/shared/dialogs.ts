import { Type } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { firstValueFrom } from 'rxjs';

export interface ConfirmData {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
}

/** Pergunta de confirmação (usa o <p-confirmdialog> do layout). */
export function confirmAction(svc: ConfirmationService, data: ConfirmData): Promise<boolean> {
    return new Promise((resolve) => {
        svc.confirm({
            header: data.title,
            message: data.message,
            icon: data.danger ? 'pi pi-exclamation-triangle' : 'pi pi-question-circle',
            acceptLabel: data.confirmLabel ?? 'Confirmar',
            rejectLabel: 'Cancelar',
            acceptButtonProps: { severity: data.danger ? 'danger' : 'primary' },
            rejectButtonProps: { severity: 'secondary', text: true },
            accept: () => resolve(true),
            reject: () => resolve(false)
        });
    });
}

/** Abre um componente como dialog e devolve o valor passado a `ref.close(valor)`. */
export async function openDialog<R = unknown>(svc: DialogService, component: Type<unknown>, header: string, data?: unknown, width = '40rem'): Promise<R | undefined> {
    const ref = svc.open(component, {
        header,
        data,
        width,
        modal: true,
        closable: true,
        dismissableMask: false,
        draggable: false,
        breakpoints: { '960px': '95vw' },
        contentStyle: { 'max-height': '75vh', overflow: 'auto' }
    });
    if (!ref) return undefined;
    return (await firstValueFrom(ref.onClose, { defaultValue: undefined })) as R | undefined;
}
