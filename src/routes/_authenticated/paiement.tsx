import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { refreshPayment } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/paiement")({
  validateSearch: z.object({ tx: z.string().uuid() }),
  head: () => ({ meta: [{ title: "Statut du paiement — Cabine Online" }, { name: "description", content: "Vérification de ton paiement." }] }),
  component: Paiement,
});

function Paiement() {
  const { tx } = Route.useSearch();
  const refresh = useServerFn(refreshPayment);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("pending");

  useEffect(() => {
    let tries = 0;
    let stop = false;
    const tick = async () => {
      try {
        const r = await refresh({ data: { txId: tx } });
        if (stop) return;
        setStatus(r.status);
        if (r.status !== "pending") { qc.invalidateQueries({ queryKey: ["transactions"] }); return; }
      } catch { /* retry */ }
      if (++tries < 20 && !stop) setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [tx, refresh, qc]);

  return (
    <div className="mx-auto max-w-sm rounded-3xl border bg-card p-8 text-center">
      {status === "pending" && <><Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" /><h1 className="mt-4 text-xl font-bold">Paiement en cours…</h1><p className="mt-2 text-sm text-muted-foreground">Valide le paiement sur ton téléphone si ce n'est pas encore fait.</p></>}
      {status === "success" && <><CheckCircle2 className="mx-auto h-12 w-12 text-success" /><h1 className="mt-4 text-xl font-bold">Paiement réussi</h1><p className="mt-2 text-sm text-muted-foreground">Ton opération est enregistrée.</p></>}
      {status === "error" && <><XCircle className="mx-auto h-12 w-12 text-destructive" /><h1 className="mt-4 text-xl font-bold">Paiement échoué</h1><p className="mt-2 text-sm text-muted-foreground">Aucun montant n'a été débité. Tu peux réessayer.</p></>}
      <Button asChild variant="hero" className="mt-6 w-full"><Link to="/dashboard">Retour à l'accueil</Link></Button>
    </div>
  );
}
