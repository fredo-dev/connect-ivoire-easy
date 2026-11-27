// src/components/WalletCard.tsx
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { formatXOF } from "@/lib/fees";
import { createDeposit } from "@/lib/deposits.functions";

const MIN_DEPOSIT = 500;
const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];
const OPERATORS = [
  { id: "orange", label: "Orange Money" },
  { id: "mtn", label: "MTN MoMo" },
  { id: "moov", label: "Moov Money" },
  { id: "wave", label: "Wave" },
];

type Props = {
  balance: number; // solde actuel en XOF
  limit: number; // plafond du compte en XOF
  defaultPhone?: string | null | undefined;
  defaultOperator?: string | null | undefined;
};

export function WalletCard({ balance, limit, defaultPhone, defaultOperator }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [operator, setOperator] = useState(defaultOperator ?? "orange");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [loading, setLoading] = useState(false);

  const room = Math.max(limit - balance, 0); // montant encore déposable
  const pct = limit > 0 ? Math.min(100, Math.round((balance / limit) * 100)) : 0;
  const value = Number(amount);

  // Fermer avec la touche Échap
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function validate(): string | null {
    if (!Number.isFinite(value) || value < MIN_DEPOSIT) return `Le dépôt minimum est de ${formatXOF(MIN_DEPOSIT)}.`;
    if (value > room) return `Ton plafond te permet de déposer ${formatXOF(room)} au maximum.`;
    if (phone.replace(/\D/g, "").length < 8) return "Entre un numéro de téléphone valide.";
    return null;
  }

  async function handleSubmit() {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setLoading(true);
    try {
      const { paymentUrl } = await createDeposit({
        data: {
          amount: value,
          operator: operator as "orange" | "mtn" | "moov" | "wave",
          phone,
          origin: window.location.origin,
        },
      });
      window.location.href = paymentUrl; // page de paiement sécurisée du prestataire
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Le dépôt n'a pas pu être lancé.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-3xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Solde disponible</p>
            <p className="mt-1 font-display text-3xl font-bold">{formatXOF(balance)}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={room === 0}
            className="flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Déposer
          </button>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Plafond du compte</span>
            <span>{formatXOF(balance)} / {formatXOF(limit)}</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={balance}
            aria-label="Utilisation du plafond"
          >
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {room > 0 ? `Tu peux encore déposer ${formatXOF(room)}.` : "Plafond atteint : tu ne peux plus déposer pour l'instant."}
          </p>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-title"
            className="w-full space-y-5 rounded-t-3xl bg-background p-6 sm:max-w-md sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="deposit-title" className="text-lg font-bold">Déposer de l'argent</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label htmlFor="deposit-amount" className="text-sm font-medium">Montant (FCFA)</label>
              <input
                id="deposit-amount"
                type="number"
                inputMode="numeric"
                min={MIN_DEPOSIT}
                max={room}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex : 5000"
                className="mt-2 w-full rounded-xl border bg-card px-4 py-3"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.filter((a) => a <= room).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(String(a))}
                    className="rounded-full border px-3 py-1 text-xs hover:border-primary/50"
                  >
                    {formatXOF(a)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Maximum autorisé : {formatXOF(room)}</p>
            </div>

            <div>
              <p className="text-sm font-medium">Payer avec</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {OPERATORS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOperator(o.id)}
                    aria-pressed={operator === o.id}
                    className={`rounded-xl border px-3 py-3 text-sm ${
                      operator === o.id ? "border-primary bg-accent font-semibold" : "bg-card"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="deposit-phone" className="text-sm font-medium">Numéro de paiement</label>
              <input
                id="deposit-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07 00 00 00 00"
                className="mt-2 w-full rounded-xl border bg-card px-4 py-3"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-full bg-brand py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {loading ? "Redirection vers le paiement…" : `Déposer ${value >= MIN_DEPOSIT ? formatXOF(value) : ""}`.trim()}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
