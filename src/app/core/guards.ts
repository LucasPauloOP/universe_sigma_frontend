import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';
import { RESOURCES } from './resources';
import { UniverseStore } from './universe-store';

/** Exige login; restaura a sessão (F5) antes de decidir. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.loggedIn()) return router.createUrlTree(['/login']);
  await auth.restore();
  return auth.loggedIn() ? true : router.createUrlTree(['/login']);
};

/** Já logado? Pula login/cadastro. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.loggedIn() ? inject(Router).createUrlTree(['/']) : true;
};

/** Páginas de dados precisam de um universe selecionado. */
export const universeGuard: CanActivateFn = () => {
  const store = inject(UniverseStore);
  return store.currentId() ? true : inject(Router).createUrlTree(['/universes']);
};

/** /r/:resource só aceita recursos conhecidos. */
export const resourceGuard: CanActivateFn = (route) => {
  const key = route.paramMap.get('resource') ?? '';
  return key in RESOURCES ? true : inject(Router).createUrlTree(['/']);
};
