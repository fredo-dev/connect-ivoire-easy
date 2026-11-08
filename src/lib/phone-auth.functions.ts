import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidPhone, phoneEmail, pinPassword } from "./phone-auth";

const phoneSchema = z.string().refine(isValidPhone, "Numéro invalide");

export const checkPhone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("profiles").select("id").eq("phone", data.phone).limit(1);
    return { exists: (rows?.length ?? 0) > 0 };
  });

export const registerPhone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      phone: phoneSchema,
      pin: z.string().regex(/^\d{4}$/),
      name: z.string().trim().min(2).max(80),
      operator: z.enum(["orange", "mtn", "moov", "wave"]),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("profiles").select("id").eq("phone", data.phone).limit(1);
    if (rows?.length) throw new Error("Ce numéro a déjà un compte");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: phoneEmail(data.phone),
      password: pinPassword(data.phone, data.pin),
      email_confirm: true,
      user_metadata: { full_name: data.name, phone: data.phone },
    });
    if (error || !created.user) throw new Error("Création du compte impossible");
    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id, full_name: data.name, phone: data.phone, operator: data.operator,
    });
    const { sendSms } = await import("./sms.server");
    await sendSms(data.phone, "Bienvenue sur Cabine Online ! Ton compte est créé. Garde ton code secret pour toi.");
    return { ok: true };
  });
