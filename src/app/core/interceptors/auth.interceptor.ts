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

        // router.getCurrentNavigation() só é não-nulo durante uma navegação em andamento — é
        // exatamente o caso de authGuard rodando restoreSession() com um token expirado/inválido,
        // e preserva o link original (ex.: QR Code, web#101) pra LoginPage voltar pra lá.
        const returnUrl = router.getCurrentNavigation()?.extractedUrl.toString();
        router.navigate(['/login'], returnUrl ? { queryParams: { returnUrl } } : undefined);
      }
      return throwError(() => error);
    }),
  );
};
