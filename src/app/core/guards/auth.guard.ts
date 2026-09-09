import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionStore } from '../auth/auth-session.store';

/**
 * Bloqueia rotas protegidas sem sessão válida. Se já há um token salvo mas o usuário ainda não
 * foi restaurado nesta carga de página (ex.: refresh do navegador), tenta restaurar antes de
 * decidir — evita mandar pro login alguém que só ainda não recarregou a sessão.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthSessionStore);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  const restored = auth.token() ? await auth.restoreSession() : false;
  if (restored) return true;

  return router.createUrlTree(['/login']);
};
