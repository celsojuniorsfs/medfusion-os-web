import { Routes } from '@angular/router';

export const CLIENTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/clients.page').then((m) => m.ClientsPage) },
];
