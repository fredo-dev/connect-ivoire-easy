import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CircleCheck, Clock3, Package, WalletCards, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CabinisteOrderCard } from "@/components/CabinisteOrderCard";
import { Button } from "@/components/ui/button";
import { getCabiniste, setCabinisteAvailability } from "@/lib/cabiniste.functions";
import { formatXOF } from "@/lib/fees";
import { INITIAL_CABINISTE_STOCK, isLowStock } from "@/lib/cabiniste/rules";
import { pageMeta } from "@/lib/page-meta";
import { enableCabineAlerts } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/cabiniste")({
  head: () => pageMeta("Espace Cabiniste — Cabine Online", "Disponibilité, stock, primes et livraisons des commandes Cabine Online."),
  component: Cabiniste,
});

function Cabiniste() {
  const qc = useQueryClient();
  const setAvailability = useServerFn(setCabinisteAvailability);
  const { data, error, isLoading } = useQuery({ queryKey: ["cabiniste"], queryFn: () => getCabiniste() });
  const [now, setNow] = useState(Date.now());
  const [switching, setSwitching] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  );

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!data) return;
    const channel = supabase.channel(`cabiniste-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => { void qc.invalidateQueries({ queryKey: ["cabiniste"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "cabiniste_state" }, () => { void qc.invalidateQueries({ queryKey: ["cabiniste"] }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [data, qc]);

  async function toggleAvailability() {
    if (!data) return;
    setSwitching(true);
    try {
      await setAvailability({ data: { available: !data.state.available } });
      await qc.invalidateQueries({ queryKey: ["cabiniste"] });
      await qc.invalidateQueries({ queryKey: ["service-availability"] });
      toast.success(data.state.available ? "Service mis en pause" : "Service réactivé");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Changement impossible"); }
    finally { setSwitching(false); }
  }

  async function handleAlerts() {
    try {
      const ok = await enableCabineAlerts();
      setAlertsEnabled(ok);
      toast[ok ? "success" : "error"](ok ? "Alertes activées" : "Les alertes n'ont pas pu être activées.");
    } catch {
      toast.error("Activation des alertes impossible.");
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Chargement de l’espace cabiniste…</p>;
  if (error || !data) return <div className="rounded-2xl border border-destructive/40 p-5"><h1 className="text-xl font-bold">Espace Cabiniste</h1><p role="alert" className="mt-2 text-sm text-muted-foreground">Impossible de charger l’espace cabiniste.</p></div>;

  const lowStock = isLowStock(data.state.stock);
  const stockPercent = Math.max(0, Math.min(100, data.state.stock / INITIAL_CABINISTE_STOCK * 100));

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm text-primary">Opérateur partenaire</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Espace Cabiniste</h1></div>
        <button type="button" role="switch" aria-checked={data.state.available} disabled={switching} onClick={toggleAvailability} className={`flex min-h-14 items-center justify-between gap-4 rounded-2xl border p-3 ${data.state.available ? "border-success/40 bg-success/10" : "border-muted-foreground/20 bg-card"}`}>
          <div className="text-left"><span className={`block text-sm font-bold ${data.state.available ? "text-success" : "text-muted-foreground"}`}>{data.state.available ? "En ligne" : "Hors ligne"}</span><span className="block text-xs text-muted-foreground">{data.state.available ? "Les paiements sont autorisés" : "Le service est fermé"}</span></div>
          <span className={`relative h-8 w-14 rounded-full transition-colors ${data.state.available ? "bg-success" : "bg-muted-foreground/40"}`}><span className={`absolute top-1 size-6 rounded-full bg-white transition-transform ${data.state.available ? "translate-x-6" : "translate-x-1"}`} /></span>
        </button>
      </header>

      {!data.state.available && <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">Service temporairement fermé : les nouveaux paiements sont bloqués.</p>}

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Compteurs financiers">
        <div className={`rounded-2xl border bg-card p-5 ${lowStock ? "border-destructive/60" : ""}`}>
          <Package className={`size-5 ${lowStock ? "text-destructive" : "text-primary"}`} />
          <p className="mt-3 text-sm text-muted-foreground">Stock disponible</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatXOF(data.state.stock)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${stockPercent}%` }} /></div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <WalletCards className="size-5 text-success" />
          <p className="mt-3 text-sm text-muted-foreground">Ma cagnotte primes</p>
          <p className="mt-1 font-display text-2xl font-bold">{formatXOF(data.state.bonuses)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{new Date(data.state.updated_at ?? Date.now()).toLocaleString("fr-FR")}</p>
        </div>
      </section>

      <button type="button" onClick={handleAlerts} className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{alertsEnabled ? "Alertes actives" : "Activer les alertes"}</p>
            <p className="text-xs text-muted-foreground">Alerte quand une commande passe en attente puis validée</p>
          </div>
        </div>
        <span className="text-sm text-primary">{alertsEnabled ? "OK" : "Activées"}</span>
      </button>

      <section className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold"><Clock3 className="size-5 text-primary" />Commandes en attente</h2><span className="rounded-full border bg-card px-2 py-1 text-xs text-muted-foreground">{data.queue.length}</span></div>
        {data.queue.length ? <div className="grid gap-4 lg:grid-cols-2">{data.queue.map((order) => <CabinisteOrderCard key={order.id} order={order} now={now} />)}</div> : <div className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground text-center">Aucune commande en attente pour le moment.</div>}
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-semibold">Livraisons du jour</h2>
        <div className="divide-y rounded-2xl border bg-card">
          {data.history.length ? data.history.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{order.label}</p>
                <p className="text-xs text-muted-foreground">{order.phone} · {new Date(order.delivered_at ?? order.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <div className="text-right"><p>{formatXOF(order.amount)}</p><span className="inline-flex items-center gap-1 text-success"><CircleCheck className="size-4" />Validé</span></div>
            </div>
          )) : <p className="p-4 text-sm text-muted-foreground">Aucune livraison aujourd’hui.</p>}
        </div>
      </section>
    </div>
  );
}
