import { RedirectFunction, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './core/layout/shell.component';

/**
 * Alias curto pro link de dentro do QR Code (web#101/#102): a etiqueta é pequena (40x30mm) e o
 * payload já carrega um uuid inteiro, então cada caractere a menos no caminho reduz a densidade
 * do módulo QR. Exportado à parte pra testar sem precisar montar o Router inteiro.
 */
export const equipmentQrAliasRedirect: RedirectFunction = (redirectData) =>
  `/orders/novo/equipamento/${redirectData.params['equipmentId']}`;

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/identity/identity.routes').then((m) => m.IDENTITY_ROUTES),
  },
  {
    path: 'os/:equipmentId',
    redirectTo: equipmentQrAliasRedirect,
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'clients', pathMatch: 'full' },
      {
        path: 'clients',
        loadChildren: () => import('./features/clients/clients.routes').then((m) => m.CLIENTS_ROUTES),
      },
      {
        path: 'orders',
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'equipamentos',
        loadChildren: () => import('./features/catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
