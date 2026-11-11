import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';

export type CabinisteOrder = {
  id: string;
  label: string;
  operator: string;
  phone: string;
  amount: number;
  status: string;
  created_at: string;
  delivered_at: string | null;
};

async function assertCabiniste(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.rpc('is_cabiniste', { _user_id: userId });
  if (error || !data) throw new Error('Accès réservé au cabiniste et au gérant');
}

export const getCabiniste = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertCabiniste(context.supabase, context.userId);
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const [state, queue, history] = await Promise.all([
    context.supabase.from('cabiniste_state').select('available,stock,bonuses,updated_at').eq('id', true).maybeSingle(),
    context.supabase.from('transactions').select('id,label,operator,phone,amount,status,created_at,delivered_at').in('status', ['success', 'paid', 'pending_delivery']).order('created_at'),
    context.supabase.from('transactions').select('id,label,operator,phone,amount,status,created_at,delivered_at').eq('status', 'delivered').gte('delivered_at', day.toISOString()).order('delivered_at', { ascending: false }).limit(100),
  ]);
  if (state.error || queue.error || history.error) throw new Error('Chargement de l’espace cabiniste impossible');
  return {
    state: state.data ?? { available: true, stock: 15000, bonuses: 0, updated_at: null },
    queue: queue.data ?? [],
    history: history.data ?? [],
  };
});

export const setCabinisteAvailability = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ available: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertCabiniste(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const result = await db.rpc('cabiniste_set_availability', { p_user: context.userId, p_available: data.available });
    if (result.error) throw new Error(result.error.message);
    return { available: data.available };
  });

export const deliverCabinisteOrder = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ transactionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCabiniste(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const result = await db.rpc('cabiniste_deliver', { p_user: context.userId, p_transaction: data.transactionId });
    if (result.error) throw new Error(result.error.message);
    return result.data as { available: boolean; stock: number; bonuses: number };
  });

export const reportCabinisteIssue = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ transactionId: z.string().uuid(), reason: z.enum(['Numéro invalide', 'Panne réseau opérateur', 'Stock insuffisant']) }))
  .handler(async ({ data, context }) => {
    await assertCabiniste(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const result = await db.rpc('cabiniste_report_issue', { p_user: context.userId, p_transaction: data.transactionId, p_reason: data.reason });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
