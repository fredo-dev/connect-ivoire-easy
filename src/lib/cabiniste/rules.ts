export const INITIAL_CABINISTE_STOCK = 15000;
export const DELIVERY_BONUS = 5;
export const LOW_STOCK_THRESHOLD = 2000;
export const WAITING_ALERT_SECONDS = 180;

export function settleDelivery(stock: number, amount: number, bonuses = 0) {
  return { stock: stock - amount, bonuses: bonuses + DELIVERY_BONUS };
}
export function isLowStock(stock: number) { return stock < LOW_STOCK_THRESHOLD; }
export function isWaitingTooLong(seconds: number) { return seconds > WAITING_ALERT_SECONDS; }
