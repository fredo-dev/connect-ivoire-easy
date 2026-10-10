import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Cabine Online" },
      { name: "description", content: "Connecte-toi ou crée ton compte Cabine Online." },
      { property: "og:title", content: "Connexion — Cabine Online" },
      { property: "og:description", content: "Accède à tes forfaits et recharges." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) navigate({ to: "/dashboard" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Vérifie ta boîte mail pour confirmer ton compte.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Connexion Google impossible");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-5">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-7">
        <Link to="/" className="font-display text-lg font-bold">Cabine<span className="text-primary">Online</span></Link>
        <h1 className="mt-5 text-2xl font-bold">{mode === "in" ? "Connexion" : "Créer un compte"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "up" && (
            <div className="space-y-1.5"><Label>Nom complet</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Mot de passe</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button type="submit" variant="hero" className="h-11 w-full" disabled={loading}>
            {loading ? "Patiente…" : mode === "in" ? "Se connecter" : "S'inscrire"}
          </Button>
        </form>
        <Button variant="outline" className="mt-3 h-11 w-full" onClick={google}>Continuer avec Google</Button>
        <button className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Pas de compte ? Inscris-toi" : "Déjà inscrit ? Connecte-toi"}
        </button>
      </div>
    </div>
  );
}
