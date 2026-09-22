import { extractEquipmentId } from './qr-scan';

describe('extractEquipmentId', () => {
  const equipmentId = '5dcd3e89-b06a-47c0-a734-3a70181c2fa5';

  it('extracts the id from the short QR alias URL', () => {
    expect(extractEquipmentId(`http://localhost:4200/os/${equipmentId}`)).toBe(equipmentId);
  });

  it('extracts the id regardless of the origin (a label printed from another environment)', () => {
    expect(extractEquipmentId(`https://app.medfusion.example/os/${equipmentId}`)).toBe(equipmentId);
  });

  it('returns null for a URL with an unrelated path', () => {
    expect(extractEquipmentId('http://localhost:4200/clients')).toBeNull();
  });

  it('returns null for text that is not a URL at all', () => {
    expect(extractEquipmentId('não é um QR Code de equipamento')).toBeNull();
  });

  it('returns null for a path that looks close but is not a valid uuid', () => {
    expect(extractEquipmentId('http://localhost:4200/os/nao-e-um-uuid')).toBeNull();
  });
});
