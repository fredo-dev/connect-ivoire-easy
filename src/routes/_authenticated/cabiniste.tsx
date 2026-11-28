import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, Clock3, Package, WalletCards, Bell, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CabinisteOrderCard } from "@/components/CabinisteOrderCard";
import { getCabiniste, setCabinisteAvailability } from "@/lib/cabiniste.functions";
import { formatXOF } from "@/lib/fees";
import { INITIAL_CABINISTE_STOCK, isLowStock } from "@/lib/cabiniste/rules";
import { pageMeta } from "@/lib/page-meta";
import { enableCabineAlerts } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/cabiniste")({
  head: () => pageMeta("Espace Cabiniste — Cabine Online", "Disponibilité, stock, primes et livraisons des commandes Cabine Online."),
  component: Cabiniste,
});

function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Audio bloqué par le navigateur
  }
}

function Cabiniste() {
  const qc = useQueryClient();
  const setAvailability = useServerFn(setCabinisteAvailability);
  const { data, error, isLoading } = useQuery({ queryKey: ["cabiniste"], queryFn: () => getCabiniste(), refetchInterval: 10000 });
  const [now, setNow] = useState(Date.now());
  const [switching, setSwitching] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(false);
  const prevQueueCount = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cabine-sound-alerts");
    if (saved === "true") setAlertsEnabled(true);
  }, []);

  useEffect(() => {
    if (!data) return;
    if (prevQueueCount.current !== null && data.queue.length > prevQueueCount.current) {
      if (alertsEnabled) playAlertSound();
      toast.info("Nouvelle commande disponible ! Soyez le plus rapide !");
    }
    prevQueueCount.current = data.queue.length;
  }, [data, alertsEnabled]);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    if (!data) return;
    const channel = supabase.channel(`cabiniste-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => { void qc.invalidateQueries({ queryKey: ["cabiniste"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "cabinistes" }, () => { void qc.invalidateQueries({ queryKey: ["cabiniste"] }); })
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
    playAlertSound();
    localStorage.setItem("cabine-sound-alerts", "true");
    setAlertsEnabled(true);
    try {
      const ok = await enableCabineAlerts();
      toast.success(ok ? "Alertes Push et sonores activées !" : "Alertes sonores activées sur cet appareil !");
    } catch (err) {
      console.error("Erreur Push Firebase :", err);
      toast.success("Alertes sonores activées sur cet appareil !");
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Chargement de l’espace cabiniste…</p>;
  if (error || !data) return <div className="rounded-2xl border border-destructive/40 p-5"><h1 className="text-xl font-bold">Espace Cabiniste</h1><p role="alert" className="mt-2 text-sm text-muted-foreground">Impossible de charger l’espace cabiniste.</p></div>;

  const lowStock = isLowStock(data.state.stock);
  const stockPercent = Math.max(0, Math.min(100, data.state.stock / INITIAL_CABINISTE_STOCK * 100));

  // Séparation : Mes commandes attrapées VS Commandes libres à prendre au plus vite
  const myOrders = data.queue.filter((o) => o.claimed_by === data.userId);
  const freeOrders = data.queue.filter((o) => o.claimed_by === null);

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm text-primary">Opérateur partenaire</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Espace Cabiniste</h1></div>
        <button type="button" role="switch" aria-checked={data.state.available} disabled={switching} onClick={toggleAvailability} className={`flex min-h-14 items-center justify-between gap-4 rounded-2xl border p-3 ${data.state.available ? "border-success/40 bg-success/10" : "border-muted-foreground/20 bg-card"}`}>
          <div className="text-left"><span className={`block text-sm font-bold ${data.state.available ? "text-success" : "text-muted-foreground"}`}>{data.state.available ? "En ligne" : "Hors ligne"}</span><span className="block text-xs text-muted-foreground">{data.state.available ? "Prêt à recevoir des commandes" : "Vous êtes en pause"}</span></div>
          <span className={`relative h-8 w-14 rounded-full transition-colors ${data.state.available ? "bg-success" : "bg-muted-foreground/40"}`}><span className={`absolute top-1 size-6 rounded-full bg-white transition-transform ${data.state.available ? "translate-x-6" : "translate-x-1"}`} /></span>
        </button>
      </header>

      {!data.state.available && <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">Votre statut est hors ligne : passez en ligne pour attraper de nouvelles commandes.</p>}

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
            <p className="text-xs text-muted-foreground">Bip sonore et notification à chaque nouvelle commande</p>
          </div>
        </div>
        <span className="text-sm font-medium text-primary">{alertsEnabled ? "Actif" : "Activer"}</span>
      </button>

      {/* 1. Mes commandes déjà verrouillées à livrer */}
      {myOrders.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
              <Zap className="size-5" /> Mes commandes à livrer ({myOrders.length})
            </h2>
          </div>
          <div className="space-y-3">
            {myOrders.map((order) => (
              <CabinisteOrderCard key={order.id} order={order} now={now} currentUserId={data.userId} canClaim={data.state.available && data.state.stock >= order.amount} />
            ))}
          </div>
        </section>
      )}

      {/* 2. File d'attente commune (le plus rapide gagne) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Clock3 className="size-5 text-primary" /> Commandes disponibles ({freeOrders.length})
          </h2>
        </div>
        {freeOrders.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">Aucune commande en attente pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {freeOrders.map((order) => (
              <CabinisteOrderCard key={order.id} order={order} now={now} currentUserId={data.userId} canClaim={data.state.available && data.state.stock >= order.amount} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Historique livré aujourd'hui */}
