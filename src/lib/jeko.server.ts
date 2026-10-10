const BASE = "https://api.jeko.africa/partner_api";

function headers() {
  const key = process.env["JEKO_API_KEY"];
  const keyId = process.env["JEKO_API_KEY_ID"];
  if (!key || !keyId) throw new Error("Jèko n'est pas configuré");
  return { "X-API-KEY": key, "X-API-KEY-ID": keyId, "Content-Type": "application/json" };
}

export type JekoPaymentRequest = {
  id: string;
  status: "pending" | "success" | "error";
  redirectUrl?: string;
  errorReason?: string | null;
};

export async function createJekoPayment(input: {
  amount: number;
  reference: string;
  paymentMethod: string;
  successUrl: string;
  errorUrl: string;
}): Promise<JekoPaymentRequest> {
  const storeId = process.env["JEKO_STORE_ID"];
  if (!storeId) throw new Error("Jèko n'est pas configuré");
  const res = await fetch(`${BASE}/payment_requests`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      storeId,
      amountCents: input.amount * 100,
      currency: "XOF",
      reference: input.reference,
      paymentDetails: {
        type: "redirect",
        data: {
          paymentMethod: input.paymentMethod,
          successUrl: input.successUrl,
          errorUrl: input.errorUrl,
        },
      },
    }),
  });
  if (!res.ok) {
    console.error("Jeko create error", res.status, await res.text());
    throw new Error("Le paiement n'a pas pu être initié");
  }
  return (await res.json()) as JekoPaymentRequest;
}

export async function getJekoPayment(id: string): Promise<JekoPaymentRequest> {
  const res = await fetch(`${BASE}/payment_requests/${encodeURIComponent(id)}`, { headers: headers() });
  if (!res.ok) {
    console.error("Jeko status error", res.status, await res.text());
    throw new Error("Statut indisponible");
  }
  return (await res.json()) as JekoPaymentRequest;
}
