import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthSessionStore } from '../auth/auth-session.store';

/**
 * Anexa Authorization: Bearer <token> em toda chamada pra `environment.apiUrl` e trata 401 global
 * (limpa sessão, redireciona pro login). 422/409 passam adiante para o componente tratar por campo
 * — ver docs/api-conventions.md § Formato de erro.
 *
 * Escopado a `environment.apiUrl` de propósito: sem isso, uma requisição pra qualquer serviço de
 * terceiro (ex.: o ViaCEP direto, achado numa revisão desta sessão) sairia com o Bearer token do
 * técnico anexado, e um 401 vindo de lá derrubaria a sessão por engano. Hoje não sobra nenhuma
 * chamada externa na base (o CEP passou a usar o proxy da própria API) — isso é defesa contra um
 * erro futuro, não a correção de um problema que ainda existe.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

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
