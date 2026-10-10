export const SERVICE_FEE_RATE = 0.015;

export function computeFee(amount: number) {
  const fee = Math.ceil(amount * SERVICE_FEE_RATE);
  return { amount, fee, total: amount + fee };
}

export const OPERATORS = [
  { id: "orange", label: "Orange", jeko: "orange" },
  { id: "mtn", label: "MTN", jeko: "mtn" },
  { id: "moov", label: "Moov", jeko: "moov" },
  { id: "wave", label: "Wave", jeko: "wave" },
] as const;

export type OperatorId = (typeof OPERATORS)[number]["id"];

export const operatorLabel = (id: string) => OPERATORS.find((o) => o.id === id)?.label ?? id;

export const formatXOF = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
