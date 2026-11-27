import { createDeposit as createDepositFn } from "./deposits.functions";

type OperatorId = "orange" | "mtn" | "moov" | "wave";

export type DepositInput = {
  amount: number;
  operator: string;
  phone: string;
};

export async function createDeposit(
  input: DepositInput
): Promise<{ paymentUrl: string }> {
  return await createDepositFn({
    data: {
      amount: Math.round(input.amount),
      operator: input.operator as OperatorId,
      phone: input.phone,
      origin: window.location.origin,
    },
  });
}
