import { createFileRoute } from "@tanstack/react-router";
import { getJekoPayment } from "@/lib/jeko.server";

type JekoWebhookPayload = {
  id?: unknown;
  paymentId?: unknown;
  payment_id?: unknown;
  paymentRequestId?: unknown;
  payment_request_id?: unknown;
  data?: {
    id?: unknown;
    paymentId?: unknown;
    payment_id?: unknown;
    paymentRequestId?: unknown;
    payment_request_id?: unknown;
  };
};

function getPaymentId(payload: JekoWebhookPayload): string | null {
  const candidates = [
    payload.id,
    payload.paymentId,
    payload.payment_id,
    payload.paymentRequestId,
    payload.payment_request_id,
    payload.data?.id,
    payload.data?.paymentId,
    payload.data?.payment_id,
    payload.data?.paymentRequestId,
    payload.data?.payment_request_id,
  ];
  const id = candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  return id?.trim() ?? null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/jeko-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: JekoWebhookPayload;
        try {
          const contentType = request.headers.get("content-type") ?? "";
          if (contentType.includes("application/x-www-form-urlencoded")) {
            const form = new URLSearchParams(await request.text());
            payload = Object.fromEntries(form.entries()) as JekoWebhookPayload;
          } else {
            payload = (await request.json()) as JekoWebhookPayload;
          }
        } catch {
          return jsonResponse({ error: "Corps de requête invalide" }, 400);
        }

        const paymentId = getPaymentId(payload);
        if (!paymentId) return jsonResponse({ error: "Identifiant de paiement manquant" }, 400);

        try {
          // Treat the webhook as a notification only; fetch the authoritative payment status from Jèko.
          const payment = await getJekoPayment(paymentId);
          if (payment.status !== "success" && payment.status !== "error") {
            return jsonResponse({ received: true, status: "pending" }, 202);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: updated, error } = await supabaseAdmin
            .from("transactions")
            .update({ status: payment.status, updated_at: new Date().toISOString() })
            .eq("jeko_id", payment.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

          if (error) {
            console.error("Jèko webhook transaction update failed", error);
            return jsonResponse({ error: "Mise à jour de la transaction impossible" }, 500);
          }

          if (!updated) {
            const { data: existing, error: lookupError } = await supabaseAdmin
              .from("transactions")
              .select("id,status")
              .eq("jeko_id", payment.id)
              .maybeSingle();

            if (lookupError) {
              console.error("Jèko webhook transaction lookup failed", lookupError);
              return jsonResponse({ error: "Vérification de la transaction impossible" }, 500);
            }
            if (!existing) return jsonResponse({ error: "Transaction introuvable" }, 404);

            // Duplicate or out-of-order webhooks are acknowledged without overwriting a final status.
            return jsonResponse({ received: true, status: existing.status, unchanged: true });
          }

          return jsonResponse({ received: true, status: payment.status });
        } catch (error) {
          console.error("Jèko webhook processing failed", error);
          return jsonResponse({ error: "Vérification du paiement auprès de Jèko impossible" }, 502);
        }
      },
    },
  },
});
