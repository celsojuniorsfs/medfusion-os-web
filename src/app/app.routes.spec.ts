import { PartialMatchRouteSnapshot } from '@angular/router';
import { equipmentQrAliasRedirect } from './app.routes';

describe('equipmentQrAliasRedirect', () => {
  it('expands the short QR alias into the full Nova OS route', () => {
    const result = equipmentQrAliasRedirect({
      params: { equipmentId: 'abc-123' },
    } as unknown as PartialMatchRouteSnapshot);

    expect(result).toBe('/orders/novo/equipamento/abc-123');
  });
});
