import {
  EQUIPMENT_SITUATIONS,
  equipmentSituationBadgeClass,
  equipmentSituationLabel,
  isSituationResolved,
  resolvedProgress,
} from './equipment-situation';

describe('equipment-situation', () => {
  it('has a label and a badge class for every situation', () => {
    for (const situation of EQUIPMENT_SITUATIONS) {
      expect(equipmentSituationLabel(situation)).toBeTruthy();
      expect(equipmentSituationBadgeClass(situation)).toBeTruthy();
    }
  });

  it('gives every situation a distinct badge class', () => {
    const classes = EQUIPMENT_SITUATIONS.map((situation) =>
      equipmentSituationBadgeClass(situation),
    );
    expect(new Set(classes).size).toBe(EQUIPMENT_SITUATIONS.length);
  });

  it('treats only completed and returned_unrepaired as resolved', () => {
    expect(EQUIPMENT_SITUATIONS.filter(isSituationResolved)).toEqual([
      'completed',
      'returned_unrepaired',
    ]);
  });

  describe('resolvedProgress()', () => {
    it('counts completed and returned_unrepaired, not the pending ones', () => {
      const order = {
        equipments: [
          { situation: 'completed' },
          { situation: 'returned_unrepaired' },
          { situation: 'awaiting_part' },
          { situation: 'in_analysis' },
        ],
      } as const;

      expect(resolvedProgress({ equipments: [...order.equipments] })).toEqual({
        resolved: 2,
        total: 4,
      });
    });

    it('is null for an order with a single equipment or none', () => {
      expect(resolvedProgress({ equipments: [{ situation: 'completed' }] })).toBeNull();
      expect(resolvedProgress({ equipments: [] })).toBeNull();
      expect(resolvedProgress({})).toBeNull();
    });
  });
});
