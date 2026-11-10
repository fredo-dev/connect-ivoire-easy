import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PayButton } from "@/components/PayButton";
import { OPERATORS, type OperatorId } from "@/lib/fees";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/recharge")({
  head: () => pageMeta("Recharge de crédit — Cabine Online", "Recharge ton crédit téléphonique Orange, MTN ou Moov."),
  component: Recharge,
});

const presets = [500, 1000, 2000, 5000, 10000];

function Recharge() {
  const [op, setOp] = useState<OperatorId>("orange");
  const [amount, setAmount] = useState(1000);
  const valid = Number.isInteger(amount) && amount >= 100 && amount <= 500000;
  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Recharge de crédit</h1>
      <div className="space-y-2">
        <Label>Opérateur</Label>
        <div className="grid grid-cols-3 gap-2">
          {OPERATORS.filter((o) => o.id !== "wave").map((o) => (
            <button key={o.id} onClick={() => setOp(o.id)} className={`rounded-xl border py-3 text-sm font-medium ${op === o.id ? "border-primary bg-accent text-primary" : "text-muted-foreground"}`}>{o.label}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Montant (FCFA)</Label>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} onClick={() => setAmount(p)} className={`rounded-full border px-3.5 py-1.5 text-sm ${amount === p ? "border-primary text-primary" : "text-muted-foreground"}`}>{p.toLocaleString("fr-FR")}</button>
          ))}
        </div>
        <Input type="number" min={100} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      <PayButton kind="recharge" amount={valid ? amount : 100} operator={op} title="Recharge de crédit"
        trigger={<Button variant="hero" size="lg" className="w-full" disabled={!valid}>Continuer</Button>} />
    </div>
  );
}
