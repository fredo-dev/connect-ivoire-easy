import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé aux gérants");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const adminUpdateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["deliver", "undeliver", "success", "error"]),
      note: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context.supabase, context.userId);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    if (data.action === "deliver") patch.delivered_at = now;
    if (data.action === "undeliver") patch.delivered_at = null;
    if (data.action === "success") patch.status = "success";
    if (data.action === "error") patch.status = "error";
    if (data.note !== undefined) patch.admin_note = data.note;
    const { error } = await db.from("transactions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertAdmin(context.supabase, context.userId);
    const { data, error } = await db.from("plans").select("*").order("operator").order("price");
    if (error) throw new Error(error.message);
    return data as Array<{ id: string; operator: string; kind: string; name: string; description: string; validity: string; price: number; active: boolean }>;
  });

const planSchema = z.object({
  id: z.string().uuid().optional(),
  operator: z.enum(["orange", "mtn", "moov", "wave"]),
  kind: z.string().min(1).max(30),
  name: z.string().min(1).max(100),
  description: z.string().max(300),
  validity: z.string().min(1).max(50),
  price: z.number().int().min(50).max(1000000),
  active: z.boolean(),
});

export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => planSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context.supabase, context.userId);
    const { id, ...rest } = data;
    const { error } = id
      ? await db.from("plans").update(rest).eq("id", id)
      : await db.from("plans").insert(rest);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertAdmin(context.supabase, context.userId);
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
    const { data: profiles } = await db.from("profiles").select("id,full_name,phone,operator");
    const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "admin");
    const admins = new Set((roles ?? []).map((r: any) => r.user_id));
    const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (list?.users ?? []).map((u: any) => ({
      id: u.id as string,
      email: (u.email ?? "") as string,
      name: (pm.get(u.id) as any)?.full_name ?? null,
      phone: (pm.get(u.id) as any)?.phone ?? null,
      isAdmin: admins.has(u.id),
      createdAt: u.created_at as string,
    }));
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.admin) throw new Error("Vous ne pouvez pas retirer votre propre accès");
    const { error } = data.admin
      ? await db.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" })
      : await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
