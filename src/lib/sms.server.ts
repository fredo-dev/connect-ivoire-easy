// Sends an SMS through Twilio (via the Lovable connector gateway). Never throws: SMS is best-effort.
export async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const lovable = process.env.LOVABLE_API_KEY;
  const twilio = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_SENDER ?? "CabineOnl";
  if (!lovable || !twilio) return { ok: false, error: "SMS non configuré" };
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": twilio,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`SMS failed [${res.status}]: ${txt}`);
      return { ok: false, error: `[${res.status}] ${txt}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("SMS error", e);
    return { ok: false, error: String(e) };
  }
}
