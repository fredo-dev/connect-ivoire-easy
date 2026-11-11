import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeFee, OPERATORS } from "./fees";
import { createJekoPayment, getJekoPayment } from "./jeko.server";

const opIds = ["orange", "mtn", "moov", "wave"] as const;
const phoneRe = /^\+225\d{10}$/;

export const getServiceAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("service_is_open");
    if (error) throw new Error("Disponibilité du service indisponible");
    return { available: !!data };
  });

const startSchema = z.object({
  kind: z.enum(["forfait", "recharge"]),
  planId: z.string().uuid().optional(),
  amount: z.number().int().min(100).max(500000).optional(),
  operator: z.enum(opIds),
  phone: z.string().regex(phoneRe, "Numéro au format +225XXXXXXXXXX"),
  paymentMethod: z.enum(opIds),
  origin: z.string().url().refine((u) => u.startsWith("https://") || u.startsWith("http://localhost")),
});

export const startPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => startSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: serviceOpen, error: availabilityError } = await context.supabase.rpc("service_is_open");
    if (availabilityError) throw new Error("Impossible de vérifier la disponibilité du service");
    if (!serviceOpen) throw new Error("Le service est temporairement fermé. Réessaie quand le cabiniste sera en ligne.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let base: number;
    let label: string;
    let planId: string | null = null;
    if (data.kind === "forfait") {
      if (!data.planId) throw new Error("Forfait manquant");
      const { data: plan, error } = await context.supabase
        .from("plans").select("*").eq("id", data.planId).single();
      if (error || !plan) throw new Error("Forfait introuvable");
      base = plan.price;
      label = plan.name;
      planId = plan.id;
    } else {
      if (!data.amount) throw new Error("Montant manquant");
      base = data.amount;
      label = `Recharge ${OPERATORS.find((o) => o.id === data.operator)?.label}`;
    }
    const { amount, fee, total } = computeFee(base);
    const reference = `CAB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: context.userId, kind: data.kind, plan_id: planId, label,
        operator: data.operator, phone: data.phone, amount, fee, total,
        payment_method: data.paymentMethod, reference,
      })
      .select("id").single();
    if (txErr || !tx) throw new Error("Impossible d'enregistrer la transaction");

    const back = `${data.origin}/paiement?tx=${tx.id}`;
    try {
      const pr = await createJekoPayment({
        amount: total, reference,
        paymentMethod: OPERATORS.find((o) => o.id === data.paymentMethod)!.jeko,
        successUrl: back, errorUrl: back,
      });
      await supabaseAdmin.from("transactions").update({ jeko_id: pr.id }).eq("id", tx.id);
      if (!pr.redirectUrl) throw new Error("Lien de paiement manquant");
      return { txId: tx.id, redirectUrl: pr.redirectUrl };
    } catch (e) {
      await supabaseAdmin.from("transactions").update({ status: "error" }).eq("id", tx.id);
      throw e;
    }
  });

export const refreshPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ txId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tx } = await context.supabase
      .from("transactions").select("id,status,jeko_id").eq("id", data.txId).single();
    if (!tx) throw new Error("Transaction introuvable");
    if (tx.status !== "pending" || !tx.jeko_id) return { status: tx.status };
    const pr = await getJekoPayment(tx.jeko_id);
    if (pr.status !== "pending") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("transactions")
        .update({ status: pr.status, updated_at: new Date().toISOString() }).eq("id", tx.id);
      const { data: full } = await supabaseAdmin.from("transactions").select("label,total,phone,reference").eq("id", tx.id).single();
      if (full?.phone) {
        const { sendSms } = await import("./sms.server");
        await sendSms(full.phone, pr.status === "success"
          ? `Cabine Online : paiement de ${full.total} FCFA reçu pour ${full.label}. Réf ${full.reference}. Ton envoi arrive bientôt.`
          : `Cabine Online : ton paiement pour ${full.label} n'a pas abouti. Réessaie depuis l'application.`);
      }
    }
    return { status: pr.status };
  });
