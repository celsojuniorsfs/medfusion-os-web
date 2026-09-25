import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionStore } from '../auth/auth-session.store';

/**
 * Bloqueia rotas protegidas sem sessão válida. Se já há um token salvo mas o usuário ainda não
 * foi restaurado nesta carga de página (ex.: refresh do navegador), tenta restaurar antes de
 * decidir — evita mandar pro login alguém que só ainda não recarregou a sessão.
 *
 * Quando o token salvo já não é mais válido, este guard NÃO constrói seu próprio UrlTree:
 * restoreSession() faz uma chamada HTTP de verdade (GET /auth/me), o 401 dela já passa pelo
 * interceptor (que limpa a sessão e navega pro /login), e um segundo redirecionamento aqui seria
 * redundante — só bloqueia a ativação (`false`). O UrlTree próprio fica só pra quando não existe
 * token nenhum pra tentar (o interceptor nunca chega a rodar, porque nenhuma chamada HTTP
 * acontece).
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthSessionStore);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  // `returnUrl` guarda a URL que a pessoa realmente queria (ex.: um link de QR Code escaneado
  // deslogada, web#101) pra LoginPage devolver pra lá depois de autenticar, em vez de sempre cair
  // na tela padrão.
  if (!auth.token()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return await auth.restoreSession();
};
