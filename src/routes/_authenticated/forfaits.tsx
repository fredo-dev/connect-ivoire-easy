import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { plansQuery } from "@/lib/queries";
import { formatXOF, OPERATORS, operatorLabel, type OperatorId } from "@/lib/fees";
import { PayButton } from "@/components/PayButton";
import { Button } from "@/components/ui/button";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/forfaits")({
  head: () => pageMeta("Forfaits — Cabine Online", "Forfaits internet, appels et mixtes Orange, MTN et Moov."),
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQuery),
  component: Forfaits,
});

const kinds = [
  { id: "all", l: "Tous" }, { id: "internet", l: "Internet" }, { id: "appels", l: "Appels" }, { id: "mixte", l: "Mixtes" },
] as const;
const dot: Record<string, string> = { orange: "bg-orange-op", mtn: "bg-mtn-op", moov: "bg-moov-op", wave: "bg-wave-op" };

function Forfaits() {
  const { data: plans } = useSuspenseQuery(plansQuery);
  const [kind, setKind] = useState<string>("all");
  const [op, setOp] = useState<string>("all");
  const list = plans.filter((p) => (kind === "all" || p.kind === kind) && (op === "all" || p.operator === op));

  const chip = (active: boolean) => `rounded-full border px-3.5 py-1.5 text-sm ${active ? "border-primary bg-accent text-primary" : "text-muted-foreground"}`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold md:text-3xl">Forfaits</h1>
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => <button key={k.id} className={chip(kind === k.id)} onClick={() => setKind(k.id)}>{k.l}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={chip(op === "all")} onClick={() => setOp("all")}>Tous opérateurs</button>
        {OPERATORS.map((o) => <button key={o.id} className={chip(op === o.id)} onClick={() => setOp(o.id)}>{o.label}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => (
          <div key={p.id} className="flex flex-col rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dot[p.operator]}`} />{operatorLabel(p.operator)}</span>
              <span className="capitalize">{p.kind}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">{p.name}</h3>
            <p className="text-sm text-muted-foreground">{p.description} · {p.validity}</p>
            <div className="mt-4 flex items-end justify-between">
              <span className="font-display text-xl font-bold text-primary">{formatXOF(p.price)}</span>
              <PayButton kind="forfait" planId={p.id} amount={p.price} operator={p.operator as OperatorId} title={p.name}
                trigger={<Button variant="hero">Acheter</Button>} />
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Aucun forfait pour ce filtre.</p>}
      </div>
    </div>
  );
}
