import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Wifi, Smartphone, ArrowRight, Brain, Bell } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { profileQuery, transactionsQuery } from "@/lib/queries";
import { formatXOF, operatorLabel } from "@/lib/fees";
import { StatusBadge } from "@/components/StatusBadge";
import { pageMeta } from "@/lib/page-meta";
import { enableCabineAlerts } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageMeta("Tableau de bord — Cabine Online", "Vue d'ensemble de ton compte, de tes forfaits et de tes opérations."),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(profileQuery),
    context.queryClient.ensureQueryData(transactionsQuery),
  ]),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useSuspenseQuery(profileQuery);
  const { data: txs } = useSuspenseQuery(transactionsQuery);
  const ok = txs.filter((t) => t.status === "success");
  const spent = ok.reduce((s, t) => s + t.total, 0);
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  const activePlans = ok.filter((t) => t.kind === "forfait" && new Date(t.created_at) >= month).length;
  const first = me.profile?.full_name?.split(" ")[0];
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(Notification.permission === "granted");

  async function handleToggleAlerts() {
    try {
      const ok = await enableCabineAlerts();
      setAlertsEnabled(ok);
      toast[ok ? "success" : "error"](ok ? "Alertes activées" : "Les alertes n'ont pas pu être activées.");
    } catch {
      toast.error("Activation des alertes impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Bonjour{first ? `, ${first}` : ""} 👋</p>
        <h1 className="text-2xl font-bold md:text-3xl">Ton tableau de bord</h1>
      </div>

      {!me.profile?.phone && (
        <Link to="/profil" className="block rounded-2xl border border-primary/40 bg-accent p-4 text-sm">
          Ajoute ton numéro et ton opérateur pour payer plus vite →
        </Link>
      )}

      <div className="rounded-3xl bg-brand p-6 text-primary-foreground shadow-glow">
        <p className="text-sm opacity-80">Total dépensé</p>
        <p className="mt-1 font-display text-3xl font-bold">{formatXOF(spent)}</p>
        <div className="mt-4 flex gap-6 text-sm">
          <div><p className="opacity-80">Forfaits ce mois</p><p className="font-semibold">{activePlans}</p></div>
          <div><p className="opacity-80">Opérateur</p><p className="font-semibold">{me.profile?.operator ? operatorLabel(me.profile.operator) : "—"}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Link to="/forfaits" className="rounded-2xl border bg-card p-5 hover:border-primary/50">
          <Wifi className="h-6 w-6 text-primary" /><p className="mt-3 font-semibold">Acheter un forfait</p>
        </Link>
        <Link to="/recharge" className="rounded-2xl border bg-card p-5 hover:border-primary/50">
          <Smartphone className="h-6 w-6 text-primary" /><p className="mt-3 font-semibold">Recharger du crédit</p>
        </Link>
        <Link to="/quiz" className="col-span-2 rounded-2xl border bg-card p-5 hover:border-primary/50 sm:col-span-1">
          <Brain className="h-6 w-6 text-primary" /><p className="mt-3 font-semibold">Jouer au quiz</p>
        </Link>
      </div>

      <button type="button" onClick={handleToggleAlerts} className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{alertsEnabled ? "Alertes actives" : "Activer les alertes"}</p>
            <p className="text-xs text-muted-foreground">Notification quand une commande est confirmée</p>
          </div>
        </div>
        <span className="text-sm text-primary">{alertsEnabled ? "OK" : "Activées"}</span>
      </button>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Dernières opérations</h2>
          <Link to="/transactions" className="flex items-center gap-1 text-sm text-primary">Tout voir <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="divide-y rounded-2xl border bg-card">
          {txs.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center justify-between p-4 text-sm">
              <div><p className="font-medium">{t.label}</p><p className="text-xs text-muted-foreground">{t.phone}</p></div>
              <div className="text-right"><p>{formatXOF(t.total)}</p><StatusBadge status={t.status} /></div>
            </div>
          ))}
          {txs.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Aucune opération pour l'instant.</p>}
        </div>
      </div>
    </div>
  );
}
