import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './shared/components/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'clients', pathMatch: 'full' },
      {
        path: 'clients',
        loadComponent: () => import('./features/clients/clients.page').then((m) => m.ClientsPage),
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/orders.page').then((m) => m.OrdersPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
