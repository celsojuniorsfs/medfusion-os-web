import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Anexa Authorization: Bearer <token> em toda chamada e trata 401 global (limpa sessão,
 * redireciona pro login). 422/409 passam adiante para o componente tratar por campo — ver
 * docs/api-conventions.md § Formato de erro.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;

  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.clearSession();
        router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
