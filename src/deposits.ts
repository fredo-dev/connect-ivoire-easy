import { startPayment } from "./payments.functions";

type OperatorId = "orange" | "mtn" | "moov" | "wave";

export type DepositInput = {
  amount: number;
  operator: string;
  phone: string;
};

function formatIvoryCoastPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("225") && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+225${digits}`;
  }
  return raw.startsWith("+") ? raw : `+225${digits}`;
}

export async function createDeposit(
  input: DepositInput
): Promise<{ paymentUrl: string }> {
  const operator = input.operator as OperatorId;
  const phone = formatIvoryCoastPhone(input.phone);

  const { redirectUrl } = await startPayment({
    data: {
      kind: "recharge",
      amount: Math.round(input.amount),
      operator,
      paymentMethod: operator,
      phone,
      origin: window.location.origin,
    },
  });

  return { paymentUrl: redirectUrl };
}
