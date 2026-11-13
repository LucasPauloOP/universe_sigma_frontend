import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, finalize, throwError } from 'rxjs';
import { Loading } from './loading';
import { Auth } from './auth';

/** Anexa o token e mostra qualquer erro da API como snackbar. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const toast = inject(MessageService);
  const loading = inject(Loading);
  const token = auth.token();
  const isAuthCall = /\/auth\/(login|register)$/.test(req.url);

  const authed =
    token && req.url.startsWith('/api')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  loading.start();
  return next(authed).pipe(
    finalize(() => loading.stop()),
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthCall) {
        auth.logout();
        toast.add({ severity: 'warn', summary: 'Sessão expirada', detail: 'Entre novamente.', life: 5000 });
      } else {
        toast.add({ severity: 'error', summary: 'Erro', detail: messageOf(err), life: 7000 });
      }
      return throwError(() => err);
    }),
  );
};

function messageOf(err: HttpErrorResponse): string {
  if (err.status === 0) return 'Não foi possível conectar ao servidor.';
  const body = err.error as { message?: string; details?: string[] } | null;
  const base = body?.message ?? 'Erro inesperado';
  return body?.details?.length ? `${base}: ${body.details.join('; ')}` : base;
}
