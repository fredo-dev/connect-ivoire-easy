import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const planSchema = z.object({
  id: z.string().uuid().optional(),
  operator: z.enum(["orange", "mtn", "moov"]),
  kind: z.enum(["internet", "appels", "mixte"]),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(300),
  validity: z.string().trim().min(1).max(50),
  price: z.number().int().min(100).max(500000),
  active: z.boolean(),
});

async function assertAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Accès réservé aux gérants.");
}

export const listAdminPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data, error } = await context.supabase
      .from("plans")
      .select("*")
      .order("operator")
      .order("kind")
      .order("price");

    if (error) throw new Error("Chargement des forfaits impossible.");
    return data ?? [];
  });

export const saveAdminPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => planSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...values } = data;

    const query = id
      ? supabaseAdmin.from("plans").update(values).eq("id", id)
      : supabaseAdmin.from("plans").insert(values);

    const { error } = await query;
    if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
    return { ok: true };
  });

export const deleteAdminPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("plans").delete().eq("id", data.id);

    if (error) {
      throw new Error(
        error.message.includes("foreign key")
          ? "Ce forfait est déjà lié à des transactions. Désactive-le plutôt que de le supprimer."
          : `Suppression impossible : ${error.message}`,
      );
    }

    return { ok: true };
  });
