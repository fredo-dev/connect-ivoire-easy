import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidPhone, phoneEmail, pinPassword } from "./phone-auth";
import { sendSms } from "./sms.server";

const phoneSchema = z.string().refine(isValidPhone, "Numéro invalide");

export function generatePhoneOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const checkPhone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("profiles").select("id").eq("phone", data.phone).limit(1);
    return { exists: (rows?.length ?? 0) > 0 };
  });

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      phone: phoneSchema,
      purpose: z.enum(["signup", "signin"]).default("signup"),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedPhone = data.phone;

    if (data.purpose === "signup") {
      const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("phone", normalizedPhone).limit(1);
      if ((existing?.length ?? 0) > 0) {
        throw new Error("Ce numéro a déjà un compte");
      }
    }

    const code = generatePhoneOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const payload = {
      phone: normalizedPhone,
      code,
      purpose: data.purpose,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };

    const { error } = await (supabaseAdmin as any)
      .from("phone_verifications")
      .upsert(payload, { onConflict: "phone" });

    if (error) throw new Error("Impossible d'envoyer le code de vérification");

    const sms = await sendSms(normalizedPhone, `Cabine Online : ton code de vérification est ${code}. Il expire dans 5 minutes.`);
    if (!sms.ok) throw new Error("Le SMS n'a pas pu être envoyé. Réessaie.");

    return { ok: true, expiresInSeconds: 300 };
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      phone: phoneSchema,
      code: z.string().regex(/^\d{6}$/),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("phone_verifications")
      .select("*")
      .eq("phone", data.phone)
      .single();

    if (error || !row) throw new Error("Code introuvable ou expiré");

    const isExpired = new Date(row.expires_at).getTime() < Date.now();
    if (isExpired) {
      await (supabaseAdmin as any).from("phone_verifications").delete().eq("phone", data.phone);
      throw new Error("Code expiré. Demande un nouveau code.");
    }

    if (row.code !== data.code) {
      throw new Error("Code incorrect");
    }

    await (supabaseAdmin as any).from("phone_verifications").delete().eq("phone", data.phone);
    return { ok: true };
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
      id: created.user.id,
      full_name: data.name,
      phone: data.phone,
      operator: data.operator,
    });

    return { ok: true };
  });
