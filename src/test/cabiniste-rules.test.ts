import { describe, expect, it } from 'vitest';
import { INITIAL_CABINISTE_STOCK, settleDelivery, isLowStock, isWaitingTooLong } from '@/lib/cabiniste/rules';

describe('Cabiniste business rules', () => {
  it('starts with 15 000 XOF of stock', () => expect(INITIAL_CABINISTE_STOCK).toBe(15000));
  it('deducts the exact 200 XOF order amount from stock', () => expect(settleDelivery(15000, 200).stock).toBe(14800));
  it('adds exactly 5 XOF to bonuses per delivery', () => expect(settleDelivery(15000, 200).bonuses).toBe(5));
  it('flags stock strictly below 2 000 XOF', () => { expect(isLowStock(1999)).toBe(true); expect(isLowStock(2000)).toBe(false); });
  it('flags waiting orders only after three minutes', () => { expect(isWaitingTooLong(180)).toBe(false); expect(isWaitingTooLong(181)).toBe(true); });
});
