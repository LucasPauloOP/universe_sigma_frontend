import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, finalize, from, switchMap, throwError } from 'rxjs';
import { Loading } from './loading';
import { Auth } from './auth';
import { API_BASE } from './api';

/** Anexa o token, renova a sessão num 401 (refresh token) e mostra erros da API como toast. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const toast = inject(MessageService);
  const loading = inject(Loading);
  const isAuthCall = /\/auth\/(login|register|refresh|logout)$/.test(req.url);
  const silent = /\/auth\/(refresh|logout)$/.test(req.url); // falhas aqui são tratadas por quem chamou

  const withToken = (token: string | null) =>
    token && req.url.startsWith(API_BASE) ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  function expired() {
    auth.logout(true, false);
    toast.add({ severity: 'warn', summary: 'Sessão expirada', detail: 'Entre novamente.', life: 5000 });
  }

  const report = (err: HttpErrorResponse) => {
    if (err.status === 401 && !isAuthCall) expired();
    else if (!silent) toast.add({ severity: 'error', summary: 'Erro', detail: messageOf(err), life: 7000 });
    return throwError(() => err);
  };

  loading.start();
  return next(withToken(auth.token())).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthCall) return report(err);
      if (!auth.canRefresh) return report(err);
      // renova uma vez e repete a requisição
      return from(auth.refresh()).pipe(
        catchError((e: HttpErrorResponse) => {
          // refresh recusado = sessão acabou; falha de rede/servidor não derruba a sessão
          if (e.status === 401 || e.status === 403 || e.status === 400 || e.status === 422) expired();
          else toast.add({ severity: 'error', summary: 'Erro', detail: messageOf(e), life: 7000 });
          return throwError(() => e);
        }),
        switchMap((token) => next(withToken(token)).pipe(catchError(report))),
      );
    }),
    finalize(() => loading.stop()),
  );
};

function messageOf(err: HttpErrorResponse): string {
  if (err.status === 0) return 'Não foi possível conectar ao servidor.';
  const body = err.error as { message?: string; details?: string[] } | null;
  const base = body?.message ?? 'Erro inesperado';
  return body?.details?.length ? `${base}: ${body.details.join('; ')}` : base;
}
