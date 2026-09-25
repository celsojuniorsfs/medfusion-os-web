import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSessionStore } from '../auth/auth-session.store';

/**
 * Anexa Authorization: Bearer <token> em toda chamada e trata 401 global (limpa sessão,
 * redireciona pro login). 422/409 passam adiante para o componente tratar por campo — ver
 * docs/api-conventions.md § Formato de erro.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthSessionStore);
  const router = inject(Router);
  const token = auth.token();

  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.clearSession();

        // Achado do code review de 25/09/2026: authGuard só monta a returnUrl quando NÃO existe
        // token nenhum — com um token salvo mas expirado/inválido, restoreSession() chama
        // /auth/me, cai aqui (401), e sem isso o técnico perdia o link do QR Code (web#101) e
        // caía sempre em '/' depois de logar de novo. router.getCurrentNavigation() só é não-nulo
        // durante uma navegação em andamento — é exatamente o caso de um guard rodando.
        const returnUrl = router.getCurrentNavigation()?.extractedUrl.toString();
        router.navigate(['/login'], returnUrl ? { queryParams: { returnUrl } } : undefined);
      }
      return throwError(() => error);
    }),
  );
};
