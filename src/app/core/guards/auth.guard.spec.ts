import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { AuthSessionStore } from '../auth/auth-session.store';
import { environment } from '../../../environments/environment';
import { authGuard } from './auth.guard';

const TOKEN_KEY = 'medfusion.auth.token';

/**
 * Achado do code review de 13/09/2026: este guard não tinha nenhum teste. Cobre os 3 ramos —
 * já autenticado, sem token nenhum, e token salvo que precisa ser (re)validado via
 * restoreSession() — e trava especificamente o ramo do achado: quando o token salvo é
 * inválido, o guard agora só bloqueia a ativação (`false`), sem construir seu próprio UrlTree
 * por cima do redirecionamento que o authInterceptor já dispara a partir do 401.
 */
describe('authGuard', () => {
  let injector: Injector;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    injector = TestBed.inject(Injector);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function runGuard() {
    return runInInjectionContext(injector, () => authGuard({} as never, {} as never));
  }

  it('allows activation when already authenticated', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const auth = TestBed.inject(AuthSessionStore);
    // Simula sessão já restaurada nesta carga de página (não usa a API pra isso aqui).
    const promise = auth.restoreSession();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/me`)
      .flush({ data: { id: 'u1', name: 'Ana', email: 'ana@medfusion.example' } });
    await promise;

    const result = await runGuard();

    expect(result).toBe(true);
  });

  it('redirects to /login when there is no token at all', async () => {
    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    httpMock.expectNone(`${environment.apiUrl}/auth/me`);
  });

  it('restores the session and allows activation when the saved token is still valid', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');

    const promise = runGuard();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/me`)
      .flush({ data: { id: 'u1', name: 'Ana', email: 'ana@medfusion.example' } });

    expect(await promise).toBe(true);
  });

  it('blocks activation WITHOUT building its own UrlTree when the saved token is invalid', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-revogado');

    const promise = runGuard();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/me`)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    // false, não um UrlTree — o authInterceptor já disparou o redirecionamento a partir do 401
    // de dentro do próprio restoreSession(); um segundo redirecionamento aqui seria redundante.
    expect(await promise).toBe(false);
  });
});
