import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { transactionsQuery } from "@/lib/queries";
import { formatXOF, operatorLabel } from "@/lib/fees";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Historique — Cabine Online" }, { name: "description", content: "Historique de tes paiements." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(transactionsQuery),
  component: Transactions,
});

function Transactions() {
  const { data } = useSuspenseQuery(transactionsQuery);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold md:text-3xl">Historique</h1>
      <div className="divide-y rounded-2xl border bg-card">
        {data.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(t.created_at).toLocaleString("fr-FR")} · {t.phone} · payé via {operatorLabel(t.payment_method)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">{formatXOF(t.total)}</p>
              <p className="text-xs text-muted-foreground">dont {formatXOF(t.fee)} de frais</p>
              {t.status === "pending"
                ? <Link to="/paiement" search={{ tx: t.id }} className="text-xs text-warning underline">En attente · vérifier</Link>
                : <StatusBadge status={t.status} />}
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Aucune transaction.</p>}
      </div>
    </div>
  );
}
