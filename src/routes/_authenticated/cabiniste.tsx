import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CircleCheck, Clock3, Package, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CabinisteOrderCard } from '@/components/CabinisteOrderCard';
import { Button } from '@/components/ui/button';
import { getCabiniste, setCabinisteAvailability } from '@/lib/cabiniste.functions';
import { formatXOF } from '@/lib/fees';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/_authenticated/cabiniste')({
  head: () => pageMeta('Espace Cabiniste — Cabine Online', 'Disponibilité, stock, primes et livraisons des commandes Cabine Online.'),
  component: Cabiniste,
});

function Cabiniste() {
  const qc = useQueryClient();
  const setAvailability = useServerFn(setCabinisteAvailability);
  const { data, error, isLoading } = useQuery({ queryKey: ['cabiniste'], queryFn: () => getCabiniste() });
  const [now, setNow] = useState(Date.now());
  const [switching, setSwitching] = useState(false);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!data) return;
    const channel = supabase.channel(`cabiniste-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => { void qc.invalidateQueries({ queryKey: ['cabiniste'] }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cabiniste_state' }, () => { void qc.invalidateQueries({ queryKey: ['cabiniste'] }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [data, qc]);

  async function toggleAvailability() {
    if (!data) return;
    setSwitching(true);
    try {
      await setAvailability({ data: { available: !data.state.available } });
      await qc.invalidateQueries({ queryKey: ['cabiniste'] });
      await qc.invalidateQueries({ queryKey: ['service-availability'] });
      toast.success(data.state.available ? 'Service mis en pause' : 'Service réactivé');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Changement impossible'); }
    finally { setSwitching(false); }
  }

  if (isLoading) return <p className="text-muted-foreground">Chargement de l’espace cabiniste…</p>;
  if (error || !data) return <div className="rounded-2xl border border-destructive/40 p-5"><h1 className="text-xl font-bold">Espace Cabiniste</h1><p role="alert" className="mt-2 text-sm text-muted-foreground">Accès réservé à l’opérateur partenaire autorisé et au gérant.</p></div>;

  const lowStock = data.state.stock < 2000;
  const stockPercent = Math.max(0, Math.min(100, data.state.stock / 15000 * 100));
  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm text-primary">Opérateur partenaire</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Espace Cabiniste</h1></div>
      <button type="button" role="switch" aria-checked={data.state.available} disabled={switching} onClick={toggleAvailability} className={`flex min-h-14 items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left ${data.state.available ? 'border-success/50 bg-success/10' : 'bg-muted'}`}>
        <span><span className={`block text-sm font-bold ${data.state.available ? 'text-success' : 'text-muted-foreground'}`}>{data.state.available ? 'En ligne' : 'Hors ligne'}</span><span className="text-xs text-muted-foreground">{data.state.available ? 'Service actif' : 'En pause'}</span></span>
        <span className={`relative h-8 w-14 rounded-full transition-colors ${data.state.available ? 'bg-success' : 'bg-muted-foreground/40'}`}><span className={`absolute top-1 size-6 rounded-full bg-card transition-transform ${data.state.available ? 'translate-x-7' : 'translate-x-1'}`} /></span>
      </button>
    </header>
    {!data.state.available && <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">Service temporairement fermé : les nouveaux paiements sont bloqués.</p>}
    <section className="grid gap-3 sm:grid-cols-2" aria-label="Compteurs financiers">
      <div className={`rounded-2xl border bg-card p-5 ${lowStock ? 'border-destructive/60' : ''}`}><Package className={`size-5 ${lowStock ? 'text-destructive' : 'text-primary'}`} /><p className="mt-3 text-sm text-muted-foreground">Stock restant</p><p className={`mt-1 font-display text-2xl font-bold ${lowStock ? 'text-destructive' : ''}`}>{formatXOF(data.state.stock)}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${lowStock ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${stockPercent}%` }} /></div>{lowStock && <p className="mt-2 text-xs font-medium text-destructive">Stock faible : moins de 2 000 FCFA.</p>}</div>
      <div className="rounded-2xl border bg-card p-5"><WalletCards className="size-5 text-success" /><p className="mt-3 text-sm text-muted-foreground">Ma cagnotte primes</p><p className="mt-1 font-display text-2xl font-bold text-success">{formatXOF(data.state.bonuses)}</p><p className="mt-4 text-xs text-muted-foreground">+5 FCFA par envoi validé</p></div>
    </section>
    <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold"><Clock3 className="size-5 text-primary" />Commandes en direct</h2><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">{data.queue.length}</span></div>
      {data.queue.length ? <div className="grid gap-4 lg:grid-cols-2">{data.queue.map(order => <CabinisteOrderCard key={order.id} order={order} now={now} />)}</div> : <div className="rounded-2xl border border-dashed p-8 text-center"><CircleCheck className="mx-auto size-7 text-success" /><p className="mt-3 text-sm text-muted-foreground">Aucune commande en attente.</p></div>}
    </section>
    <section className="space-y-3 border-t pt-6"><h2 className="text-lg font-semibold">Livraisons du jour</h2><div className="divide-y rounded-2xl border bg-card">{data.history.map(order => <div key={order.id} className="flex items-center justify-between gap-3 p-4 text-sm"><div><p className="font-medium">{order.label}</p><p className="mt-1 text-xs text-muted-foreground">{order.phone}</p></div><div className="text-right"><p>{formatXOF(order.amount)}</p><p className="mt-1 text-xs text-success">{order.delivered_at ? new Date(order.delivered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div></div>)}{!data.history.length && <p className="p-6 text-center text-sm text-muted-foreground">Aucune livraison validée aujourd’hui.</p>}</div></section>
    <Button variant="outline" className="w-full" disabled={switching} onClick={toggleAvailability}>{data.state.available ? 'Mettre le service en pause' : 'Réactiver le service'}</Button>
  </div>;
}
