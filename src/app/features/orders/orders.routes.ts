import { Routes } from '@angular/router';

export const ORDERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/orders.page').then((m) => m.OrdersPage) },
  { path: 'novo', loadComponent: () => import('./pages/order-form.page').then((m) => m.OrderFormPage) },
];
