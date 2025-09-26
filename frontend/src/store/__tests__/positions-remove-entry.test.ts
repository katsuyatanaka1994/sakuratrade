import { entry, removeEntryLot, getGroups, clearAllPositions } from '../positions';

const SYMBOL = '7203';

describe('removeEntryLot', () => {
  beforeEach(() => {
    clearAllPositions();
  });

  test('subtracts lot quantity and keeps position when remaining shares exist', () => {
    entry(SYMBOL, 'LONG', 1000, 100, 'トヨタ', 'chat-a');

    const removed = removeEntryLot(SYMBOL, 'LONG', 1000, 40, 'chat-a');
    expect(removed).toBe(true);

    const groups = getGroups('chat-a');
    expect(groups).toHaveLength(1);
    expect(groups[0].positions[0].qtyTotal).toBe(60);
    expect(groups[0].positions[0].avgPrice).toBeCloseTo(1000);
  });

  test('removes entire position when quantity reaches zero', () => {
    entry(SYMBOL, 'LONG', 1200, 50, 'トヨタ', 'chat-b');

    const removed = removeEntryLot(SYMBOL, 'LONG', 1200, 50, 'chat-b');
    expect(removed).toBe(true);

    const groups = getGroups('chat-b');
    expect(groups).toHaveLength(0);
  });
});
