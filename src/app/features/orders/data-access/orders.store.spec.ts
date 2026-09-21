import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { components } from '../../../core/api-types';
import { OrdersStore } from './orders.store';

type OrderInput = components['schemas']['OrderInput'];

const TOKEN_KEY = 'medfusion.auth.token';

const minimalOrderInput = (): OrderInput => ({
  number: 1337,
  date: '2026-09-21',
  client_id: 'client-1',
  picked_up: false,
  warranty: false,
  technical_training: false,
  on_site_quote: false,
  rental: false,
  labor_cost: 100,
  equipments: [{ equipment_id: 'equipment-1' }],
  items: [],
});

const anOrder = (overrides: Partial<{ id: string; number: number }> = {}) => ({
  id: overrides.id ?? 'order-1',
  number: overrides.number ?? 1337,
});

describe('OrdersStore', () => {
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

  it('nextNumber() reads the suggested number without a data envelope', async () => {
    const store = TestBed.inject(OrdersStore);

    const promise = store.nextNumber();
    httpMock.expectOne(`${environment.apiUrl}/orders/next-number`).flush({ number: 1337 });

    await expect(promise).resolves.toBe(1337);
  });

  it('create() adds the returned order to the entity collection', async () => {
    const store = TestBed.inject(OrdersStore);

    const promise = store.create(minimalOrderInput());
    httpMock.expectOne(`${environment.apiUrl}/orders`).flush({ data: anOrder() });

    await promise;

    expect(store.entities().map((order) => order.id)).toContain('order-1');
  });

  /** 409 de número duplicado, 422 de validação — a página decide a mensagem certa pra cada um. */
  it('create() propagates the error instead of swallowing it', async () => {
    const store = TestBed.inject(OrdersStore);

    const promise = store.create(minimalOrderInput());
    httpMock
      .expectOne(`${environment.apiUrl}/orders`)
      .flush({ message: 'Número de OS já utilizado por outra ordem de serviço.' }, { status: 409, statusText: 'Conflict' });

    await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
  });

  it('reset() clears entities and error/loading state', async () => {
    const store = TestBed.inject(OrdersStore);

    const promise = store.create(minimalOrderInput());
    httpMock.expectOne(`${environment.apiUrl}/orders`).flush({ data: anOrder() });
    await promise;

    store.reset();

    expect(store.entities()).toHaveLength(0);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  /** Ver o mesmo teste nos outros stores — achado do code review de 13/09/2026. */
  it('resets itself automatically when the session becomes unauthenticated (logout)', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const auth = TestBed.inject(AuthSessionStore);
    const store = TestBed.inject(OrdersStore);

    const promise = store.create(minimalOrderInput());
    httpMock.expectOne(`${environment.apiUrl}/orders`).flush({ data: anOrder() });
    await promise;
    expect(store.entities()).toHaveLength(1);

    auth.clearSession();
    TestBed.flushEffects();

    expect(store.entities()).toHaveLength(0);
  });
});
