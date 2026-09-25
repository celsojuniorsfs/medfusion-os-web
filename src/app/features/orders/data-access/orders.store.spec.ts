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

  it('load() populates entities and pagination metadata, filtering only defined params', async () => {
    const store = TestBed.inject(OrdersStore);

    const promise = store.load(2, { client_id: 'client-1', status: 'open' });
    httpMock
      .expectOne(`${environment.apiUrl}/orders?page=2&client_id=client-1&status=open`)
      .flush({
        data: [anOrder()],
        meta: { current_page: 2, last_page: 3, per_page: 15, total: 40 },
      });
    await promise;

    expect(store.entities()).toHaveLength(1);
    expect(store.page()).toBe(2);
    expect(store.lastPage()).toBe(3);
    expect(store.total()).toBe(40);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() sets an error message and clears loading on failure', async () => {
    const store = TestBed.inject(OrdersStore);

    const promise = store.load();
    httpMock
      .expectOne(`${environment.apiUrl}/orders?page=1`)
      .flush({ message: 'Erro' }, { status: 500, statusText: 'Server Error' });
    await promise;

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Não foi possível carregar as ordens de serviço.');
  });

  it('findOne() fetches a single order by id and adds it to entities', async () => {
    const store = TestBed.inject(OrdersStore);

    const promise = store.findOne('order-1');
    httpMock.expectOne(`${environment.apiUrl}/orders/order-1`).flush({ data: anOrder() });

    const order = await promise;

    expect(order.id).toBe('order-1');
    expect(store.entities().map((o) => o.id)).toContain('order-1');
  });

  /**
   * Achado do code review de 25/09/2026: addEntity não faz nada se o id já existir — quem abre
   * uma OS que já apareceu antes numa listagem ficaria vendo a cópia antiga, não o que este GET
   * acabou de buscar.
   */
  it('findOne() refreshes an order that was already in the store from an earlier load()', async () => {
    const store = TestBed.inject(OrdersStore);

    const loadPromise = store.load();
    httpMock
      .expectOne(`${environment.apiUrl}/orders?page=1`)
      .flush({ data: [anOrder({ id: 'order-1', number: 1337 })], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } });
    await loadPromise;
    expect(store.entities()[0].number).toBe(1337);

    const findOnePromise = store.findOne('order-1');
    httpMock.expectOne(`${environment.apiUrl}/orders/order-1`).flush({ data: anOrder({ id: 'order-1', number: 9999 }) });
    await findOnePromise;

    expect(store.entities()).toHaveLength(1);
    expect(store.entities()[0].number).toBe(9999);
  });

  /**
   * Achado do code review de 25/09/2026: sem uma guarda de requisição, duas chamadas de load()
   * disparadas em sequência (trocar de filtro rápido) podiam terminar fora de ordem e deixar a
   * tabela mostrando o resultado da chamada mais ANTIGA.
   */
  it('load() ignores a stale response that arrives after a newer call already resolved', async () => {
    const store = TestBed.inject(OrdersStore);

    const firstCall = store.load(1, { status: 'open' });
    const firstRequest = httpMock.expectOne(`${environment.apiUrl}/orders?page=1&status=open`);

    const secondCall = store.load(1, { status: 'completed' });
    const secondRequest = httpMock.expectOne(`${environment.apiUrl}/orders?page=1&status=completed`);

    // A segunda chamada responde primeiro...
    secondRequest.flush({ data: [anOrder({ id: 'order-2' })], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } });
    await secondCall;
    // ...e só depois a primeira (mais antiga) responde — não pode sobrescrever o resultado da segunda.
    firstRequest.flush({ data: [anOrder({ id: 'order-1' })], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } });
    await firstCall;

    expect(store.entities().map((o) => o.id)).toEqual(['order-2']);
    expect(store.filters()).toEqual({ status: 'completed' });
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
