import { Routes } from '@angular/router';

export const ALERTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/alerts.page').then((m) => m.AlertsPage) },
];
