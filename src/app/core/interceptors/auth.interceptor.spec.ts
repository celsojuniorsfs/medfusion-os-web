import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthSessionStore } from '../auth/auth-session.store';
import { authInterceptor } from './auth.interceptor';

const TOKEN_KEY = 'medfusion.auth.token';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches the Authorization header when a token exists', () => {
    localStorage.setItem(TOKEN_KEY, 'meu-token');
    TestBed.inject(AuthSessionStore); // constrói o store lendo o token acima

    http.get('/qualquer').subscribe();

    const req = httpMock.expectOne('/qualquer');
    expect(req.request.headers.get('Authorization')).toBe('Bearer meu-token');
    req.flush({});
  });

  it('does not attach the Authorization header when there is no token', () => {
    TestBed.inject(AuthSessionStore);

    http.get('/qualquer').subscribe();

    const req = httpMock.expectOne('/qualquer');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('on a 401 response, clears the session and navigates to /login', () => {
    localStorage.setItem(TOKEN_KEY, 'meu-token');
    const auth = TestBed.inject(AuthSessionStore);
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.get('/qualquer').subscribe({ error: () => {} });

    httpMock
      .expectOne('/qualquer')
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.token()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    // Sem navegação em andamento (chamada HTTP direta, não através de uma rota/guard), não há
    // returnUrl pra preservar — ver o teste de returnUrl abaixo pro caso com navegação real.
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], undefined);
  });

  it('on a 401 during a route navigation, preserves the intended URL as returnUrl', () => {
    // Mesmo cenário do web#101/authGuard: um token salvo mas expirado. restoreSession() chama
    // /auth/me, cai aqui, e sem isso o técnico perdia o link do QR Code e caía sempre em '/'
    // depois de logar de novo. router.getCurrentNavigation() só é não-nulo com uma navegação de
    // verdade em andamento — dublado aqui pra não depender do timing exato de guards assíncronos.
    localStorage.setItem(TOKEN_KEY, 'token-expirado');
    TestBed.inject(AuthSessionStore);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const intendedUrl = router.parseUrl('/orders/novo/equipamento/eq-1');
    vi.spyOn(router, 'getCurrentNavigation').mockReturnValue({ extractedUrl: intendedUrl } as never);

    http.get('/auth/me').subscribe({ error: () => {} });

    httpMock
      .expectOne('/auth/me')
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/orders/novo/equipamento/eq-1' } });
  });

  it('on a non-401 error response, leaves the session untouched', () => {
    // 422/409 passam adiante pro componente tratar por campo — ver api-conventions.md § Formato
    // de erro. O interceptor só reage especificamente a 401.
    localStorage.setItem(TOKEN_KEY, 'meu-token');
    const auth = TestBed.inject(AuthSessionStore);
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.post('/qualquer', {}).subscribe({ error: () => {} });

    httpMock
      .expectOne('/qualquer')
      .flush({ message: 'The given data was invalid.', errors: {} }, { status: 422, statusText: 'Unprocessable Entity' });

    expect(auth.token()).toBe('meu-token');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
