import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { ClientsStore } from './clients.store';

const TOKEN_KEY = 'medfusion.auth.token';

const aClient = (overrides: Partial<{ id: string; name: string }> = {}) => ({
  id: overrides.id ?? 'c1',
  person_type: 'company' as const,
  name: overrides.name ?? 'Hospital São Lucas',
  tax_id: '31233218000110',
});

describe('ClientsStore', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('load() populates entities and pagination metadata on success', async () => {
    const store = TestBed.inject(ClientsStore);

    const promise = store.load(1, 'lucas');
    httpMock.expectOne(`${environment.apiUrl}/clients?page=1&search=lucas`).flush({
      data: [aClient()],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
    });
    await promise;

    expect(store.entities()).toHaveLength(1);
    expect(store.total()).toBe(1);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() sets an error message and clears loading on failure', async () => {
    const store = TestBed.inject(ClientsStore);

    const promise = store.load();
    httpMock
      .expectOne(`${environment.apiUrl}/clients?page=1`)
      .flush({ message: 'Erro' }, { status: 500, statusText: 'Server Error' });
    await promise;

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Não foi possível carregar os clientes.');
    expect(store.entities()).toHaveLength(0);
  });

  it('create() adds the returned client to the entity collection', async () => {
    const store = TestBed.inject(ClientsStore);

    const promise = store.create({ person_type: 'company', name: 'Novo Cliente', tax_id: '11222333000181' });
    httpMock
      .expectOne(`${environment.apiUrl}/clients`)
      .flush({ data: aClient({ id: 'c2', name: 'Novo Cliente' }) });
    await promise;

    expect(store.entities().map((c) => c.id)).toContain('c2');
  });

  it('remove() takes the client out of the entity collection', async () => {
    const store = TestBed.inject(ClientsStore);

    const loadPromise = store.load();
    httpMock
      .expectOne(`${environment.apiUrl}/clients?page=1`)
      .flush({ data: [aClient()], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } });
    await loadPromise;

    const removePromise = store.remove('c1');
    httpMock.expectOne(`${environment.apiUrl}/clients/c1`).flush(null);
    await removePromise;

    expect(store.entities()).toHaveLength(0);
  });

  it('reset() clears entities and restores the initial pagination state', async () => {
    const store = TestBed.inject(ClientsStore);

    const promise = store.load(2, 'busca');
    httpMock
      .expectOne(`${environment.apiUrl}/clients?page=2&search=busca`)
      .flush({ data: [aClient()], meta: { current_page: 2, last_page: 3, per_page: 15, total: 40 } });
    await promise;

    store.reset();

    expect(store.entities()).toHaveLength(0);
    expect(store.search()).toBe('');
    expect(store.page()).toBe(1);
    expect(store.lastPage()).toBe(1);
    expect(store.total()).toBe(0);
    expect(store.error()).toBeNull();
  });

  /**
   * Achado do code review de 13/09/2026: AuthSessionStore.clearSession() não limpava este
   * store — como `core/` não pode importar `features/` (ver README), a reação ao logout mora
   * aqui, via withHooks observando AuthSessionStore (a direção de dependência permitida).
   */
  it('resets itself automatically when the session becomes unauthenticated (logout)', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const auth = TestBed.inject(AuthSessionStore);
    const store = TestBed.inject(ClientsStore);

    const loadPromise = store.load();
    httpMock
      .expectOne(`${environment.apiUrl}/clients?page=1`)
      .flush({ data: [aClient()], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } });
    await loadPromise;
    expect(store.entities()).toHaveLength(1);

    auth.clearSession();
    TestBed.flushEffects();

    expect(store.entities()).toHaveLength(0);
  });
});
