import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Delete, Loader2, Phone, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

type Step = "splash" | "phone" | "operator" | "code" | "confirm";

const OP_STYLE: Record<OperatorId, { badge: string; sub: string; cls: string }> = {
  orange: { badge: "O", sub: "Orange Money", cls: "bg-orange-op text-background" },
  mtn: { badge: "M", sub: "MTN MoMo", cls: "bg-mtn-op text-background" },
  moov: { badge: "MV", sub: "Moov Money", cls: "bg-moov-op text-foreground" },
  wave: { badge: "W", sub: "Wave", cls: "bg-wave-op text-background" },
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand shadow-glow">
        <Phone className="h-6 w-6 text-primary-foreground" />
      </div>
      <span className="font-display text-2xl font-bold">Cabine<span className="text-primary">Online</span></span>
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("splash");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [admin, setAdmin] = useState(false);
  const [raw, setRaw] = useState("");
  const [op, setOp] = useState<OperatorId | null>(null);
  const [code, setCode] = useState("");
  const [code2, setCode2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const phone = normalizePhone(raw);

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s === "splash" ? "phone" : s)), 2200);
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard" }); });
    return () => clearTimeout(t);
  }, [navigate]);

  async function goAfterLogin() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (admin) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (!isAdmin) { await supabase.auth.signOut(); setError("Ce compte n'a pas l'accès gérant"); setCode(""); return; }
      navigate({ to: "/admin" });
    } else navigate({ to: "/dashboard" });
  }

  async function submitPhone(e: FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) { setError("Entrez un numéro valide à 10 chiffres"); return; }
    setError(null); setLoading(true);
    try {
      const r = await checkPhone({ data: { phone } });
      const m = admin ? "signin" : mode;
      if (m === "signin" && !r.exists) { setError("Aucun compte avec ce numéro"); return; }
      if (m === "signup" && r.exists) { setError("Ce numéro a déjà un compte, connectez-vous"); setMode("signin"); return; }
      setCode(""); setCode2("");
      setStep(m === "signin" ? "code" : "operator");
    } catch { setError("Vérification impossible, réessayez"); } finally { setLoading(false); }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 4) { setError("Le code doit contenir 4 chiffres"); return; }
    setError(null);
    if (mode === "signup" && !admin) { setStep("confirm"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password: pinPassword(phone, code) });
    if (error) { setError("Code secret incorrect"); setCode(""); } else await goAfterLogin();
    setLoading(false);
  }

  async function submitConfirm(e: FormEvent) {
    e.preventDefault();
    if (code2 !== code) { setError("Les codes ne correspondent pas"); setCode2(""); return; }
    setError(null); setLoading(true);
    try {
      await registerPhone({ data: { phone, pin: code, name: phone, operator: op ?? "orange" } });
      const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password: pinPassword(phone, code) });
      if (error) throw error;
      await goAfterLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible");
      setCode2("");
    } finally { setLoading(false); }
  }

  if (step === "splash") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand">
        <div className="flex flex-col items-center animate-in zoom-in-95 duration-700">
          <div className="mb-6 animate-pulse rounded-3xl bg-background/95 p-4"><Logo /></div>
          <p className="text-sm text-primary-foreground/80">Internet & Appels en Côte d'Ivoire</p>
        </div>
        <div className="absolute bottom-12 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary-foreground/70" />
          <p className="text-xs text-primary-foreground/60">Chargement...</p>
        </div>
      </div>
    );
  }

  const primaryBtn = "flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30";
  const backBtn = "mt-4 w-full rounded-xl py-3 text-sm text-muted-foreground transition-colors hover:text-foreground";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center animate-in fade-in">
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">{admin ? "Espace gérant" : "Côte d'Ivoire"}</p>
        </div>

        <div key={step} className="animate-in zoom-in-95 fade-in duration-300">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-center text-sm text-destructive">{error}</div>
          )}

          {step === "phone" && (
            <div>
              <h2 className="mb-2 text-center text-xl font-bold">
                {admin ? "Connexion gérant" : mode === "signup" ? "Créer un compte" : "Connexion"}
              </h2>
              <p className="mb-6 text-center text-sm text-muted-foreground">Entrez votre numéro de téléphone</p>
              <form onSubmit={submitPhone}>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">+225</span>
                  <input type="tel" autoFocus placeholder="07 00 00 00 00" value={raw} maxLength={14}
                    onChange={(e) => setRaw(e.target.value.replace(/[^\d ]/g, ""))}
                    className="w-full rounded-2xl border border-input bg-card py-4 pl-16 pr-4 text-center text-lg tracking-wider outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/60" />
                </div>
                <button type="submit" disabled={loading} className={`${primaryBtn} mt-6`}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continuer <ArrowRight className="h-5 w-5" /></>}
                </button>
              </form>
              <div className="mt-6 flex flex-col items-center gap-3 text-sm">
                {!admin && (
                  <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
                    className="text-muted-foreground transition-colors hover:text-primary">
                    {mode === "signup" ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
                  </button>
                )}
                <button onClick={() => { setAdmin(!admin); setError(null); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" /> {admin ? "Retour à l'espace client" : "Accès gérant"}
                </button>
              </div>
            </div>
          )}

          {step === "operator" && (
            <div>
              <h2 className="mb-2 text-center text-xl font-bold">Votre opérateur</h2>
              <p className="mb-6 text-center text-sm text-muted-foreground">Choisissez votre réseau</p>
              <div className="space-y-3">
                {OPERATORS.map((o) => (
                  <button key={o.id} onClick={() => { setOp(o.id); setError(null); setCode(""); setStep("code"); }}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 transition-all hover:scale-[1.02] hover:border-primary/50 active:scale-[0.98]">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${OP_STYLE[o.id].cls}`}>{OP_STYLE[o.id].badge}</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold">{o.label}</p>
                      <p className="text-sm text-muted-foreground">{OP_STYLE[o.id].sub}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
              <button onClick={() => { setStep("phone"); setError(null); }} className={backBtn}>Retour</button>
            </div>
          )}

          {(step === "code" || step === "confirm") && (
            <div>
              <h2 className="mb-2 text-center text-xl font-bold">
                {step === "confirm" ? "Confirmez votre code" : mode === "signup" && !admin ? "Créez votre code secret" : "Votre code secret"}
              </h2>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                {step === "confirm" ? "Saisissez-le à nouveau" : mode === "signup" && !admin ? "4 chiffres pour sécuriser votre compte" : "Saisissez votre code à 4 chiffres"}
              </p>
              <form onSubmit={step === "confirm" ? submitConfirm : submitCode}>
                <CodeEntry value={step === "confirm" ? code2 : code}
                  onChange={(v) => { (step === "confirm" ? setCode2 : setCode)(v); setError(null); }} />
                <button type="submit" disabled={(step === "confirm" ? code2 : code).length !== 4 || loading} className={`${primaryBtn} mt-6`}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>{step === "confirm" ? "Créer mon compte" : mode === "signup" && !admin ? "Continuer" : "Se connecter"} <ArrowRight className="h-5 w-5" /></>
                  )}
                </button>
              </form>
              {step === "code" && (mode === "signin" || admin) && (
                <a href={`https://wa.me/2250596742870?text=${encodeURIComponent(`Bonjour, j'ai oublié mon code secret Cabine Online. Mon numéro : ${phone}`)}`}
                  target="_blank" rel="noreferrer"
                  className="mt-4 block text-center text-sm text-primary hover:underline">
                  Code secret oublié ?
                </a>
              )}
              <button onClick={() => {
                setError(null);
                if (step === "confirm") { setCode2(""); setStep("code"); }
                else { setCode(""); setStep(mode === "signup" && !admin ? "operator" : "phone"); }
              }} className={backBtn}>Retour</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeEntry({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (k: string) => {
    if (k === "del") onChange(value.slice(0, -1));
    else if (k && value.length < 4) onChange(value + k);
  };
  return (
    <>
      <div className="mb-8 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-all ${i < value.length ? "border-primary bg-primary/10" : "border-border bg-card text-transparent"}`}>
            {i < value.length ? "●" : ""}
          </div>
        ))}
      </div>
      <input type="tel" autoFocus inputMode="numeric" maxLength={4} value={value} aria-label="Code secret"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="absolute -z-10 h-px w-px opacity-0" />
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
          k === "" ? <div key={i} /> : (
            <button key={i} type="button" onClick={() => press(k)} aria-label={k === "del" ? "Effacer" : k}
              className={`flex h-16 items-center justify-center rounded-2xl bg-card transition-all hover:bg-muted active:scale-95 ${k === "del" ? "text-muted-foreground" : "text-2xl font-semibold"}`}>
              {k === "del" ? <Delete className="h-6 w-6" /> : k}
            </button>
          ))}
      </div>
    </>
  );
}
