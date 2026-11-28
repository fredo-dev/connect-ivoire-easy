import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CabinisteOrder = {
  id: string;
  label: string;
  operator: string;
  phone: string;
  amount: number;
  status: string;
  claimed_by: string | null;
  created_at: string;
  delivered_at: string | null;
};

async function assertCabiniste(
  db: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null; error: { message: string } | null }> },
  userId: string
) {
  const { data, error } = await db.rpc("is_cabiniste", { _user_id: userId });
  if (error || !data) throw new Error("Accès réservé au cabiniste validé et au gérant");
}

// 1. Inscription d'un nouveau cabiniste
export const registerCabiniste = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email("Adresse email invalide"),
      password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
      fullName: z.string().min(2, "Veuillez entrer votre nom complet"),
      phone: z.string().min(10, "Numéro de téléphone invalide"),
    })
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: auth, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (authErr || !auth.user) {
      throw new Error(authErr?.message ?? "Erreur lors de la création du compte");
    }

    const { error: dbErr } = await supabaseAdmin.from("cabinistes").insert({
      user_id: auth.user.id,
      full_name: data.fullName,
      phone: data.phone,
      stock: 15000,
      bonuses: 0,
      is_approved: false,
    });

    if (dbErr) {
      throw new Error("Erreur lors de la création du profil cabiniste");
    }

    return { ok: true };
  });

// 2. Récupérer le tableau de bord du cabiniste connecté
export const getCabiniste = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCabiniste(context.supabase, context.userId);
    const day = new Date();
    day.setHours(0, 0, 0, 0);

    const [state, queue, history] = await Promise.all([
      context.supabase
        .from("cabinistes")
        .select("available,stock,bonuses,updated_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("transactions")
        .select("id,label,operator,phone,amount,status,claimed_by,created_at,delivered_at")
        .in("status", ["pending", "success", "paid", "pending_delivery"])
        .or(`claimed_by.is.null,claimed_by.eq.${context.userId}`)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("transactions")
        .select("id,label,operator,phone,amount,status,claimed_by,created_at,delivered_at")
        .eq("status", "delivered")
        .eq("claimed_by", context.userId)
        .gte("delivered_at", day.toISOString())
        .order("delivered_at", { ascending: false }),
    ]);

    if (state.error || queue.error || history.error) {
      throw new Error("Chargement de l’espace cabiniste impossible");
    }

    return {
      userId: context.userId,
      state: state.data ?? { available: true, stock: 15000, bonuses: 0, updated_at: null },
      queue: (queue.data ?? []) as CabinisteOrder[],
      history: (history.data ?? []) as CabinisteOrder[],
    };
  });

// 3. Attraper une commande ("Le plus rapide gagne")
export const claimCabinisteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ transactionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCabiniste(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { data: won, error } = await db.rpc("claim_transaction", {
      p_user: context.userId,
      p_transaction: data.transactionId,
    });

    if (error) throw new Error(error.message);
    if (!won) {
      throw new Error("Trop tard ! Un autre cabiniste a déjà pris cette commande.");
    }

    return { ok: true };
  });

// 4. Valider une transaction en attente
export const validatePendingTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ transactionId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertCabiniste(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .update({ status: "success", updated_at: new Date().toISOString() })
      .eq("id", data.transactionId)
      .eq("status", "pending")
      .select("id,label,total,phone")
      .single();

    if (txErr || !tx) {
      throw new Error("Cette commande n’est plus en attente ou est déjà traitée.");
    }

    const { sendSms } = await import("./sms.server");
    await sendSms(
      tx.phone,
      `Cabine Online : ton achat ${tx.label} a été validé. Montant ${tx.total} FCFA. Ton accès arrive bientôt.`
    );

    return { ok: true };
  });

// 5. Activer / Désactiver la disponibilité du cabiniste
export const setCabinisteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ available: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertCabiniste(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const result = await db.rpc("cabiniste_set_availability", {
      p_user: context.userId,
      p_available: data.available,
    });
    if (result.error) throw new Error(result.error.message);
    return { available: data.available };
  });

// 6. Clôturer la livraison (déduit le stock et ajoute le bonus)
export const deliverCabinisteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ transactionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertCabiniste(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const result = await db.rpc("cabiniste_deliver", {
      p_user: context.userId,
      p_transaction: data.transactionId,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data as { available: boolean; stock: number; bonuses: number };
  });

// 7. Signaler un problème sur une commande
export const reportCabinisteIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      transactionId: z.string().uuid(),
      reason: z.enum(["Numéro invalide", "Panne réseau opérateur", "Stock insuffisant"]),
    })
  )
  .handler(async ({ data, context }) => {
    await assertCabiniste(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const result = await db.rpc("cabiniste_report_issue", {
      p_user: context.userId,
      p_transaction: data.transactionId,
      p_reason: data.reason,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
// 8. Lister tous les cabinistes (pour le Gérant)
export const listAllCabinistes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès réservé au gérant.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("cabinistes")
      .select("user_id, full_name, phone, available, stock, bonuses, is_approved, updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw new Error("Impossible de charger la liste des cabinistes.");
    return data ?? [];
  });

// 9. Valider ou suspendre un cabiniste inscrit (Gérant)
export const approveCabiniste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ targetUserId: z.string().uuid(), approve: z.boolean() }))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès réservé au gérant.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("cabinistes")
      .update({ is_approved: data.approve, updated_at: new Date().toISOString() })
      .eq("user_id", data.targetUserId);

    if (error) throw new Error("Modification du statut impossible.");
    return { ok: true };
  });

// 10. Recharger le stock d'un cabiniste (Gérant)
export const topUpCabinisteStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ targetUserId: z.string().uuid(), amount: z.number().min(1000) }))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès réservé au gérant.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: readErr } = await supabaseAdmin
      .from("cabinistes")
      .select("stock")
      .eq("user_id", data.targetUserId)
      .single();

    if (readErr || !current) throw new Error("Cabiniste introuvable.");

    const { error } = await supabaseAdmin
      .from("cabinistes")
      .update({ stock: current.stock + data.amount, updated_at: new Date().toISOString() })
      .eq("user_id", data.targetUserId);

    if (error) throw new Error("Recharge du stock impossible.");
    return { ok: true };
  });

