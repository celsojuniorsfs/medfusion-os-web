import { Routes } from '@angular/router';

export const CLIENTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/clients.page').then((m) => m.ClientsPage) },
  { path: 'novo', loadComponent: () => import('./pages/client-form.page').then((m) => m.ClientFormPage) },
  { path: ':id/editar', loadComponent: () => import('./pages/client-form.page').then((m) => m.ClientFormPage) },
];
