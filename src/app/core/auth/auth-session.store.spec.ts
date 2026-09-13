import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthSessionStore } from './auth-session.store';

const TOKEN_KEY = 'medfusion.auth.token';

describe('AuthSessionStore', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  // Não injeta o store aqui de propósito: o token salvo em localStorage só é lido na
  // CONSTRUÇÃO do store (withState), então cada teste que depende de um token pré-existente
  // precisa escrever no localStorage ANTES de chamar TestBed.inject(AuthSessionStore) —
  // injetar cedo demais no beforeEach fixaria o token como null pra sempre neste teste.
  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts unauthenticated with no token in localStorage', () => {
    const store = TestBed.inject(AuthSessionStore);

    expect(store.isAuthenticated()).toBe(false);
    expect(store.token()).toBeNull();
  });

  it('reads a previously saved token from localStorage on construction', () => {
    localStorage.setItem(TOKEN_KEY, 'token-antigo');

    const store = TestBed.inject(AuthSessionStore);

    expect(store.token()).toBe('token-antigo');
    // Um token salvo sozinho não autentica — falta o `user`, só restoreSession() traz isso.
    expect(store.isAuthenticated()).toBe(false);
  });

  it('logs in, saves the token and marks the session authenticated', async () => {
    const store = TestBed.inject(AuthSessionStore);

    const promise = store.login('ana@medfusion.example', 'segredo');

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({
      token: 'novo-token',
      user: { id: 'u1', name: 'Ana', email: 'ana@medfusion.example' },
    });

    await promise;

    expect(store.isAuthenticated()).toBe(true);
    expect(store.token()).toBe('novo-token');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('novo-token');
  });

  it('restoreSession loads the user when the saved token is still valid', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const store = TestBed.inject(AuthSessionStore);

    const promise = store.restoreSession();

    httpMock.expectOne(`${environment.apiUrl}/auth/me`).flush({
      data: { id: 'u1', name: 'Ana', email: 'ana@medfusion.example' },
    });

    expect(await promise).toBe(true);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('restoreSession clears the session when the saved token is no longer valid', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-revogado');
    const store = TestBed.inject(AuthSessionStore);

    const promise = store.restoreSession();

    httpMock
      .expectOne(`${environment.apiUrl}/auth/me`)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    expect(await promise).toBe(false);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.token()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('restoreSession without any saved token resolves to false without an HTTP call', async () => {
    const store = TestBed.inject(AuthSessionStore);

    await expect(store.restoreSession()).resolves.toBe(false);
    httpMock.expectNone(`${environment.apiUrl}/auth/me`);
  });

  it('logout calls the API, clears the session and navigates to /login', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const store = TestBed.inject(AuthSessionStore);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    const promise = store.logout();
    httpMock.expectOne(`${environment.apiUrl}/auth/logout`).flush({});
    await promise;

    expect(store.isAuthenticated()).toBe(false);
    expect(store.token()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('logout still clears the session and navigates even if the API call fails', async () => {
    // logout() usa try/finally, não try/catch — o efeito colateral (limpar sessão + navegar)
    // acontece antes do erro se propagar, mas a promise em si ainda rejeita (o único chamador,
    // shell.component.html, não dá await nela — dispara e esquece de propósito).
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const store = TestBed.inject(AuthSessionStore);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    const promise = store.logout();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/logout`)
      .flush({ message: 'Erro' }, { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toBeTruthy();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.token()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('clearSession resets user and token and removes the token from localStorage', () => {
    localStorage.setItem(TOKEN_KEY, 'algum-token');
    const store = TestBed.inject(AuthSessionStore);

    store.clearSession();

    expect(store.token()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
