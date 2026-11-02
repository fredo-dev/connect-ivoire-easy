import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Delete } from "lucide-react";
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
      { name: "description", content: "Connecte-toi avec ton numéro et ton code secret." },
      { property: "og:title", content: "Connexion — Cabine Online" },
      { property: "og:description", content: "Accède à tes forfaits et recharges." },
    ],
  }),
  component: AuthPage,
});

type Step = "splash" | "phone" | "operator" | "pin" | "confirm";

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("splash");
  const [raw, setRaw] = useState("");
  const [exists, setExists] = useState(false);
  const [name, setName] = useState("");
  const [op, setOp] = useState<OperatorId>("orange");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [loading, setLoading] = useState(false);
  const phone = normalizePhone(raw);

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s === "splash" ? "phone" : s)), 1600);
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) navigate({ to: "/dashboard" }); });
    return () => { clearTimeout(t); data.subscription.unsubscribe(); };
  }, [navigate]);

  async function submitPhone() {
    if (!isValidPhone(phone)) { toast.error("Entre un numéro à 10 chiffres"); return; }
    setLoading(true);
    try {
      const r = await checkPhone({ data: { phone } });
      setExists(r.exists);
      setPin(""); setPin2("");
      setStep(r.exists ? "pin" : "operator");
    } catch { toast.error("Vérification impossible"); } finally { setLoading(false); }
  }

  async function onPinComplete(value: string) {
    if (exists) {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password: pinPassword(phone, value) });
      setLoading(false);
      if (error) { toast.error("Code secret incorrect"); setPin(""); }
    } else {
      setStep("confirm");
    }
  }

  async function onConfirmComplete(value: string) {
    if (value !== pin) { toast.error("Les codes ne correspondent pas"); setPin2(""); return; }
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

  const back = () => setStep(step === "confirm" ? "pin" : step === "pin" ? (exists ? "phone" : "operator") : "phone");

  if (step === "splash") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary">
        <span className="animate-pulse font-display text-4xl font-bold text-primary-foreground">CabineOnline</span>
        <p className="mt-3 text-sm text-primary-foreground/80">Forfaits & recharges en un clin d'œil</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-background px-5">
      <div className="flex w-full max-w-sm flex-col py-8">
        <div className="flex h-10 items-center">
          {step !== "phone" && (
            <button onClick={back} aria-label="Retour" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
          )}
        </div>

        {step === "phone" && (
          <div className="mt-6 flex flex-1 flex-col">
            <h1 className="text-2xl font-bold">Entre ton numéro de téléphone</h1>
            <p className="mt-2 text-sm text-muted-foreground">Pour te connecter ou créer ton compte.</p>
            <div className="mt-8 flex items-center gap-2 rounded-2xl border bg-card px-4 py-3">
              <span className="font-semibold">🇨🇮 +225</span>
              <input
                inputMode="numeric" autoFocus value={raw} maxLength={14}
                onChange={(e) => setRaw(e.target.value.replace(/[^\d ]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && submitPhone()}
                placeholder="07 01 23 45 67"
                className="flex-1 bg-transparent text-lg tracking-wider outline-none"
              />
            </div>
            <Button variant="hero" className="mt-auto h-12 w-full rounded-full" disabled={loading || raw.replace(/\D/g, "").length < 10} onClick={submitPhone}>
              {loading ? "Patiente…" : "Suivant"}
            </Button>
          </div>
        )}

        {step === "operator" && (
          <div className="mt-6 flex flex-1 flex-col">
            <h1 className="text-2xl font-bold">Crée ton compte</h1>
            <p className="mt-2 text-sm text-muted-foreground">{phone}</p>
            <Input className="mt-6 h-12" placeholder="Ton nom complet" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="mt-6 text-sm font-medium">Ton opérateur</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {OPERATORS.map((o) => (
                <button key={o.id} onClick={() => setOp(o.id)} className={`rounded-2xl border py-5 font-semibold ${op === o.id ? "border-primary bg-accent text-primary" : "text-muted-foreground"}`}>{o.label}</button>
              ))}
            </div>
            <Button variant="hero" className="mt-auto h-12 w-full rounded-full" disabled={name.trim().length < 2} onClick={() => { setPin(""); setStep("pin"); }}>
              Suivant
            </Button>
          </div>
        )}

        {step === "pin" && (
          <PinPad
            title={exists ? "Entre ton code secret" : "Choisis un code secret"}
            subtitle={exists ? phone : "4 chiffres, garde-le pour toi"}
            value={pin} onChange={setPin} onComplete={onPinComplete} loading={loading}
          />
        )}
        {step === "confirm" && (
          <PinPad title="Confirme ton code secret" subtitle="Saisis-le à nouveau" value={pin2} onChange={setPin2} onComplete={onConfirmComplete} loading={loading} />
        )}
      </div>
    </div>
  );
}

function PinPad({ title, subtitle, value, onChange, onComplete, loading }: {
  title: string; subtitle: string; value: string; loading: boolean;
  onChange: (v: string) => void; onComplete: (v: string) => void;
}) {
  function press(d: string) {
    if (loading || value.length >= 4) return;
    const v = value + d;
    onChange(v);
    if (v.length === 4) onComplete(v);
  }
  return (
    <div className="mt-6 flex flex-1 flex-col items-center">
      <h1 className="text-center text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-10 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < value.length ? "border-primary bg-primary" : "border-muted-foreground"}`} />
        ))}
      </div>
      <p className="mt-4 h-5 text-sm text-muted-foreground">{loading ? "Patiente…" : ""}</p>
      <div className="mt-auto grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k) =>
          k === "" ? <span key="empty" /> : (
            <button key={k} type="button" aria-label={k === "del" ? "Effacer" : k}
              onClick={() => (k === "del" ? onChange(value.slice(0, -1)) : press(k))}
              className="flex h-16 items-center justify-center rounded-2xl text-2xl font-semibold hover:bg-muted active:bg-accent">
              {k === "del" ? <Delete className="h-6 w-6" /> : k}
            </button>
          ))}
      </div>
    </div>
  );
}
