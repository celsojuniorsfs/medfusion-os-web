import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthSessionStore } from '../auth/auth-session.store';
import { UserRole } from '../auth/user-role';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
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

  async function signIn(role: UserRole): Promise<void> {
    const promise = TestBed.inject(AuthSessionStore).login('ana@medfusion.example', 'segredo');
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({
        token: 'token',
        user: { id: 'u1', name: 'Ana', email: 'ana@medfusion.example', role },
      });
    await promise;
  }

  function runGuard() {
    return runInInjectionContext(injector, () =>
      roleGuard('administrative', 'general_admin')({} as never, {} as never),
    );
  }

  it.each<UserRole>(['administrative', 'general_admin'])('allows %s', async (role) => {
    await signIn(role);

    expect(runGuard()).toBe(true);
  });

  it('redirects a technician to /clients', async () => {
    await signIn('technician');

    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/clients');
  });

  it('redirects when there is no user', () => {
    expect(runGuard()).toBeInstanceOf(UrlTree);
  });
});
