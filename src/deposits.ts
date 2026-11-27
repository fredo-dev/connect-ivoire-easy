// src/lib/deposits.ts
export type DepositInput = {
  amount: number; // en XOF
  operator: string; // orange | mtn | moov | wave
  phone: string;
};

/**
 * Demande au serveur de créer un paiement chez le prestataire
 * (CinetPay, PayDunya, Wave, etc.) et renvoie l'URL de paiement.
 * Le solde n'est JAMAIS crédité ici : il l'est par le serveur,
 * quand le prestataire confirme le paiement (webhook).
 */
export async function createDeposit(input: DepositInput): Promise<{ paymentUrl: string }> {
  const res = await fetch("/api/deposits", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message ?? "Le dépôt n'a pas pu être lancé.");
  }
  return res.json();
}
