import { Routes } from '@angular/router';

export const IDENTITY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage) },
];
