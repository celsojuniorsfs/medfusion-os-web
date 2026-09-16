import { EquipmentModel, equipmentModelLabel, equipmentModelMatchesSearch } from './equipment-models';

describe('equipmentModelMatchesSearch', () => {
  const equipmentModel: EquipmentModel = {
    id: 'em1',
    name: 'Ultrassom',
    brand: 'Sonopus',
    model: 'XYZ-100',
  };

  it('matches an empty search term', () => {
    expect(equipmentModelMatchesSearch(equipmentModel, '')).toBe(true);
    expect(equipmentModelMatchesSearch(equipmentModel, '   ')).toBe(true);
  });

  it('matches case-insensitively by name, brand or model', () => {
    expect(equipmentModelMatchesSearch(equipmentModel, 'ultra')).toBe(true);
    expect(equipmentModelMatchesSearch(equipmentModel, 'sonopus')).toBe(true);
    expect(equipmentModelMatchesSearch(equipmentModel, 'xyz-100')).toBe(true);
  });

  it('does not match an unrelated term', () => {
    expect(equipmentModelMatchesSearch(equipmentModel, 'monitor')).toBe(false);
  });

  it('does not throw when brand or model are null', () => {
    // Acontece de verdade: o backfill cria entradas a partir de equipamentos anteriores ao api#92,
    // que podem ter ficado sem marca/modelo.
    const bare: EquipmentModel = { id: 'em2', name: 'Aparelho antigo', brand: null, model: null };

    expect(equipmentModelMatchesSearch(bare, 'antigo')).toBe(true);
    expect(equipmentModelMatchesSearch(bare, 'sonopus')).toBe(false);
  });
});

describe('equipmentModelLabel', () => {
  it('joins name, brand and model', () => {
    expect(equipmentModelLabel({ id: 'em1', name: 'Ultrassom', brand: 'Sonopus', model: 'XYZ-100' })).toBe(
      'Ultrassom · Sonopus · XYZ-100',
    );
  });

  it('omits the parts that are missing', () => {
    expect(equipmentModelLabel({ id: 'em2', name: 'Aparelho antigo', brand: null, model: null })).toBe(
      'Aparelho antigo',
    );
  });
});
