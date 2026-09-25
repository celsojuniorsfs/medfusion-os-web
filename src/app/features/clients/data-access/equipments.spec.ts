import { equipmentMatchesSearch, formatAccessories } from './equipments';

describe('equipmentMatchesSearch', () => {
  const equipment = {
    name: 'Bisturi Elétrico',
    brand: 'Marca X',
    model: 'BX-2000',
    serial_number: 'SN-123',
  };

  it('matches an empty search term', () => {
    expect(equipmentMatchesSearch(equipment, '')).toBe(true);
    expect(equipmentMatchesSearch(equipment, '   ')).toBe(true);
  });

  it('matches case-insensitively by name, brand, model or serial number', () => {
    expect(equipmentMatchesSearch(equipment, 'bisturi')).toBe(true);
    expect(equipmentMatchesSearch(equipment, 'marca x')).toBe(true);
    expect(equipmentMatchesSearch(equipment, 'bx-2000')).toBe(true);
    expect(equipmentMatchesSearch(equipment, 'sn-123')).toBe(true);
  });

  it('does not match an unrelated term', () => {
    expect(equipmentMatchesSearch(equipment, 'monitor')).toBe(false);
  });

  it('does not throw when optional fields are null', () => {
    const bareEquipment = { name: 'Bisturi', brand: null, model: null, serial_number: null };

    expect(equipmentMatchesSearch(bareEquipment, 'bisturi')).toBe(true);
    expect(equipmentMatchesSearch(bareEquipment, 'monitor')).toBe(false);
  });
});

describe('formatAccessories', () => {
  it('returns a dash when there are no accessories', () => {
    expect(formatAccessories({})).toBe('—');
    expect(formatAccessories({ accessories: [] })).toBe('—');
  });

  it('joins accessory names, marking quantities greater than 1', () => {
    const equipment = {
      accessories: [
        { accessory_id: '1', name: 'Cabo de força', quantity: 1 },
        { accessory_id: '2', name: 'Eletrodo', quantity: 3 },
      ],
    };

    // Achado em produção: interpolar o array direto no template produzia "[object Object]".
    expect(formatAccessories(equipment)).toBe('Cabo de força, Eletrodo (x3)');
  });
});
