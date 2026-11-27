import { createServerFn } from '@tanstack/react-start';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { OPERATORS } from './fees';

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '').replace(/^225/, '');
  if (digits.length !== 10) throw new Error('Numéro de téléphone invalide');
  return `+225${digits}`;
}

async function reconcilePendingDeposits(userId: string): Promise<number> {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: pending } = await db
    .from('deposits')
    .select('id,jeko_id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .not('jeko_id', 'is', null)
    .gte('created_at', since);
  if (!pending?.length) return 0;

  const { getJekoPayment } = await import('./jeko.server');
  let stillPending = 0;
  await Promise.all(
    pending.map(async (d) => {
      try {
        const pr = await getJekoPayment(d.jeko_id as string);
        if (pr.status === 'success') {
          await db.rpc('deposit_confirm', { p_deposit: d.id, p_ref: d.jeko_id });
        } else if (pr.status === 'pending') {
          stillPending++;
        } else {
          await db.from('deposits').update({ status: 'failed' }).eq('id', d.id).eq('status', 'pending');
        }
      } catch {
        stillPending++;
      }
    }),
  );
  return stillPending;
}

export const getWallet = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pending = await reconcilePendingDeposits(context.userId);
    const r = await context.supabase
      .from('wallets')
      .select('balance,deposit_limit')
      .eq('user_id', context.userId)
      .maybeSingle();
    if (r.error) throw new Error(r.error.message);
    return { balance: r.data?.balance ?? 0, limit: r.data?.deposit_limit ?? 500000, pending };
  });

export const walletQuery = queryOptions({
  queryKey: ['wallet'],
  queryFn: () => getWallet(),
  refetchInterval: (query) => (query.state.data?.pending ? 5000 : false),
});

const depositSchema = z.object({
  amount: z.number().int().min(500).max(2000000),
  operator: z.enum(['orange', 'mtn', 'moov', 'wave']),
  phone: z.string().min(8).max(20),
  origin: z.string().url().refine((u) => u.startsWith('https://') || u.startsWith('http://localhost')),
});

export const createDeposit = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => depositSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const { createJekoPayment } = await import('./jeko.server');
    const phone = normalizePhone(data.phone);

    const r = await db.rpc('deposit_create', {
      p_user: context.userId,
      p_amount: data.amount,
      p_operator: data.operator,
      p_phone: phone,
    });
    if (r.error) throw new Error(r.error.message);
    const depositId = r.data as string;

    const reference = `DEP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const back = `${data.origin}/dashboard`;
    try {
      const pr = await createJekoPayment({
        amount: data.amount,
        reference,
        paymentMethod: OPERATORS.find((o) => o.id === data.operator)!.jeko,
        successUrl: back,
        errorUrl: back,
      });
      if (!pr.redirectUrl) throw new Error('Lien de paiement manquant');
      await db.from('deposits').update({ jeko_id: pr.id, reference }).eq('id', depositId);
      return { paymentUrl: pr.redirectUrl };
    } catch (e) {
      await db.from('deposits').update({ status: 'failed' }).eq('id', depositId);
      throw e;
    }
  });
