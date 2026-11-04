import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Delete, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OPERATORS, type OperatorId } from "@/lib/fees";
import { isValidPhone, normalizePhone, phoneEmail, pinPassword } from "@/lib/phone-auth";
import { checkPhone, registerPhone } from "@/lib/phone-auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Cabine Online" },
      { name: "description", content: "Connecte-toi ou crée ton compte avec ton numéro et ton code secret." },
      { property: "og:title", content: "Connexion — Cabine Online" },
      { property: "og:description", content: "Accède à tes forfaits et recharges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup";
type Step = "form" | "pin" | "confirm";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const [op, setOp] = useState<OperatorId>("orange");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [loading, setLoading] = useState(false);
  const phone = normalizePhone(raw);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) navigate({ to: "/dashboard" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function next() {
    if (!isValidPhone(phone)) { toast.error("Entre un numéro à 10 chiffres"); return; }
    if (mode === "signup" && name.trim().length < 2) { toast.error("Entre ton nom complet"); return; }
    setLoading(true);
    try {
      const r = await checkPhone({ data: { phone } });
      if (mode === "login" && !r.exists) { toast.error("Aucun compte avec ce numéro. Inscris-toi."); setMode("signup"); return; }
      if (mode === "signup" && r.exists) { toast.error("Ce numéro a déjà un compte. Connecte-toi."); setMode("login"); return; }
      setPin(""); setPin2(""); setStep("pin");
    } catch { toast.error("Vérification impossible"); } finally { setLoading(false); }
  }

  async function validatePin() {
    if (pin.length !== 4) return;
    if (mode === "signup") { setPin2(""); setStep("confirm"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password: pinPassword(phone, pin) });
    setLoading(false);
    if (error) { toast.error("Code secret incorrect"); setPin(""); }
  }

  async function validateConfirm() {
    if (pin2.length !== 4) return;
    if (pin2 !== pin) { toast.error("Les codes ne correspondent pas"); setPin2(""); return; }
    setLoading(true);
    try {
      await registerPhone({ data: { phone, pin, name, operator: op } });
      const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password: pinPassword(phone, pin) });
      if (error) throw error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Inscription impossible");
      setPin2("");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-hero px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand shadow-glow">
            <Phone className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Cabine<span className="text-primary">Online</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">Forfaits & recharges en un clin d'œil</p>
        </div>

        <div className="rounded-3xl border bg-card p-6">
          {step === "form" ? (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
                {(["login", "signup"] as Mode[]).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    className={`rounded-full py-2 text-sm font-semibold transition ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {m === "login" ? "Connexion" : "Inscription"}
                  </button>
                ))}
              </div>

              {mode === "signup" && (
                <div className="mt-5">
                  <label className="text-sm font-medium">Nom complet</label>
                  <Input className="mt-2 h-12" placeholder="Ton nom complet" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}

              <div className="mt-5">
                <label className="text-sm font-medium">Numéro de téléphone</label>
                <div className="mt-2 flex items-center gap-2 rounded-xl border bg-background px-4 py-3">
                  <span className="font-semibold">🇨🇮 +225</span>
                  <input inputMode="numeric" value={raw} maxLength={14}
                    onChange={(e) => setRaw(e.target.value.replace(/[^\d ]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && next()}
                    placeholder="07 01 23 45 67"
                    className="flex-1 bg-transparent tracking-wider outline-none" />
                </div>
              </div>

              {mode === "signup" && (
                <div className="mt-5">
                  <label className="text-sm font-medium">Ton opérateur</label>
                  <div className="mt-2 flex flex-col gap-2">
                    {OPERATORS.map((o) => (
                      <button key={o.id} type="button" onClick={() => setOp(o.id)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 font-semibold ${op === o.id ? "border-primary bg-accent text-primary" : "text-muted-foreground"}`}>
                        {o.label}
                        {op === o.id && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="hero" className="mt-6 h-12 w-full rounded-full" disabled={loading} onClick={next}>
                {loading ? "Patiente…" : "Continuer"}
              </Button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(step === "confirm" ? "pin" : "form")} aria-label="Retour" className="-ml-2 rounded-full p-2 hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </button>
              {step === "pin" ? (
                <PinPad
                  title={mode === "login" ? "Entre ton code secret" : "Choisis un code secret"}
                  subtitle={phone} value={pin} onChange={setPin} onValidate={validatePin} loading={loading}
                />
              ) : (
                <PinPad title="Confirme ton code secret" subtitle="Saisis-le à nouveau" value={pin2} onChange={setPin2} onValidate={validateConfirm} loading={loading} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PinPad({ title, subtitle, value, onChange, onValidate, loading }: {
  title: string; subtitle: string; value: string; loading: boolean;
  onChange: (v: string) => void; onValidate: () => void;
}) {
  const press = (d: string) => { if (!loading && value.length < 4) onChange(value + d); };
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-center text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-6 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`flex h-14 w-12 items-center justify-center rounded-xl border-2 text-2xl ${i < value.length ? "border-primary text-primary" : "border-border"}`}>
            {i < value.length ? "•" : ""}
          </span>
        ))}
      </div>
      <div className="mt-6 grid w-full grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((k) => (
          <button key={k} type="button" aria-label={k === "del" ? "Effacer" : k === "ok" ? "Valider" : k}
            disabled={loading || (k === "ok" && value.length !== 4)}
            onClick={() => (k === "del" ? onChange(value.slice(0, -1)) : k === "ok" ? onValidate() : press(k))}
            className={`flex h-14 items-center justify-center rounded-xl text-xl font-semibold disabled:opacity-40 ${k === "ok" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}>
            {k === "del" ? <Delete className="h-5 w-5" /> : k === "ok" ? <Check className="h-6 w-6" /> : k}
          </button>
        ))}
      </div>
      <p className="mt-3 h-5 text-sm text-muted-foreground">{loading ? "Patiente…" : ""}</p>
    </div>
  );
}
