import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deliverCabinisteOrder, reportCabinisteIssue, type CabinisteOrder } from '@/lib/cabiniste.functions';
import { formatXOF } from '@/lib/fees';
import { isWaitingTooLong } from '@/lib/cabiniste/rules';

const operatorStyle: Record<string, string> = {
  orange: 'border-orange-op/50 bg-orange-op/15 text-orange-op',
  mtn: 'border-mtn-op/50 bg-mtn-op/15 text-mtn-op',
  moov: 'border-moov-op/50 bg-moov-op/15 text-moov-op',
  wave: 'border-wave-op/50 bg-wave-op/15 text-wave-op',
};
const labels: Record<string, string> = { orange: 'Orange', mtn: 'MTN', moov: 'Moov', wave: 'Wave' };

export function CabinisteOrderCard({ order, now }: { order: CabinisteOrder; now: number }) {
  const deliver = useServerFn(deliverCabinisteOrder), report = useServerFn(reportCabinisteIssue);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const elapsed = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 1000));
  const waiting = `${String(Math.floor(elapsed / 60)).padStart(2, '0')} min ${String(elapsed % 60).padStart(2, '0')} s`;

  async function act(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await work();
      await qc.invalidateQueries({ queryKey: ['cabiniste'] });
      toast.success(message);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Action impossible'); }
    finally { setBusy(false); }
  }
  async function copyPhone() {
    try { await navigator.clipboard.writeText(order.phone); toast.success('Copié !'); }
    catch { toast.error('Copie impossible sur cet appareil'); }
  }

  return <article className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${operatorStyle[order.operator] ?? ''}`}>{labels[order.operator] ?? order.operator}</span>
      <p className={`text-sm font-semibold tabular-nums ${isWaitingTooLong(elapsed) ? 'text-destructive' : 'text-muted-foreground'}`}>En attente depuis {waiting}</p>
    </div>
    <div><h3 className="font-semibold">{order.label}</h3><p className="mt-1 text-primary">{formatXOF(order.amount)}</p></div>
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
      <p className="break-all font-display text-xl font-bold tracking-wide sm:text-2xl">{order.phone}</p>
      <Button type="button" variant="outline" size="sm" onClick={copyPhone} aria-label={`Copier le numéro ${order.phone}`}><Copy className="size-4" />Copier</Button>
    </div>
    <Button className="h-12 w-full bg-success text-primary-foreground hover:bg-success/90" disabled={busy} onClick={() => {
      if (window.confirm(`Confirmer l’envoi de ${order.label} au ${order.phone} ?`)) void act(() => deliver({ data: { transactionId: order.id } }), 'Envoi validé : stock et primes actualisés');
    }}><Check className="size-5" />Valider l’envoi</Button>
    <div className="grid gap-2 border-t pt-4 sm:grid-cols-[1fr_auto]">
      <label className="sr-only" htmlFor={`issue-${order.id}`}>Motif du problème</label>
      <select id={`issue-${order.id}`} className="h-10 rounded-md border bg-background px-3 text-sm" value={reason} onChange={e => setReason(e.target.value)}>
        <option value="">Choisir un problème…</option><option>Numéro invalide</option><option>Panne réseau opérateur</option><option>Stock insuffisant</option>
      </select>
      <Button variant="outline" className="border-destructive/40 text-destructive" disabled={busy || !reason} onClick={() => act(() => report({ data: { transactionId: order.id, reason: reason as 'Numéro invalide' | 'Panne réseau opérateur' | 'Stock insuffisant' } }), 'Problème signalé au gérant')}><TriangleAlert className="size-4" />Signaler un problème</Button>
    </div>
  </article>;
}
