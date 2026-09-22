import { Routes } from '@angular/router';

export const CLIENTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/clients.page').then((m) => m.ClientsPage) },
  { path: 'novo', loadComponent: () => import('./pages/client-form.page').then((m) => m.ClientFormPage) },
  { path: ':id/editar', loadComponent: () => import('./pages/client-form.page').then((m) => m.ClientFormPage) },
  { path: ':id/equipamentos', loadComponent: () => import('./pages/equipments.page').then((m) => m.EquipmentsPage) },
  {
    path: ':id/equipamentos/novo',
    loadComponent: () => import('./pages/equipment-form.page').then((m) => m.EquipmentFormPage),
  },
  {
    path: ':id/equipamentos/:equipmentId/editar',
    loadComponent: () => import('./pages/equipment-form.page').then((m) => m.EquipmentFormPage),
  },
  {
    path: ':id/equipamentos/:equipmentId/qrcode',
    loadComponent: () => import('./pages/equipment-qr-code.page').then((m) => m.EquipmentQrCodePage),
  },
];
