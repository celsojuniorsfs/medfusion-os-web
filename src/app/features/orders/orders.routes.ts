import { Routes } from '@angular/router';

export const ORDERS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/orders.page').then((m) => m.OrdersPage) },
  { path: 'novo', loadComponent: () => import('./pages/order-form.page').then((m) => m.OrderFormPage) },
  {
    path: 'novo/equipamento/:equipmentId',
    loadComponent: () => import('./pages/order-form.page').then((m) => m.OrderFormPage),
  },
  { path: 'escanear', loadComponent: () => import('./pages/scan-equipment.page').then((m) => m.ScanEquipmentPage) },
  {
    path: 'historico/equipamento/:equipmentId',
    loadComponent: () => import('./pages/equipment-history.page').then((m) => m.EquipmentHistoryPage),
  },
  // Precisa vir por último: rota com parâmetro genérico captura qualquer segmento, então tem que
  // ficar depois de todas as rotas literais acima (novo/escanear/historico), senão elas nunca
  // seriam alcançadas.
  { path: ':id', loadComponent: () => import('./pages/order-detail.page').then((m) => m.OrderDetailPage) },
];
