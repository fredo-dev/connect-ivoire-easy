import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerCabiniste } from "@/lib/cabiniste.functions";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/inscription-cabiniste")({
  head: () =>
    pageMeta(
      "Devenir Cabiniste — Cabine Online",
      "Inscrivez-vous comme opérateur partenaire Cabine Online et gagnez des primes sur chaque livraison."
    ),
  component: InscriptionCabinistePage,
});

function InscriptionCabinistePage() {
  const register = useServerFn(registerCabiniste);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ data: form });
      setSubmitted(true);
      toast.success("Inscription enregistrée avec succès !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer le compte.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md space-y-5 rounded-2xl border border-success/40 bg-card p-6 text-center shadow-sm sm:p-8">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h1 className="text-2xl font-bold">Demande envoyée !</h1>
        <p className="text-sm text-muted-foreground">
          Votre compte cabiniste a bien été créé avec un stock de départ de <strong>15 000 FCFA</strong>.
          Le gérant doit maintenant valider votre profil avant que vous puissiez vous connecter et prendre des commandes.
        </p>
        <Link to="/" className="inline-block w-full">
          <Button variant="outline" className="w-full">
            Retour à l’accueil
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Store className="size-6" />
        </div>
        <h1 className="text-2xl font-bold">Devenir Cabiniste Partenaire</h1>
        <p className="text-sm text-muted-foreground">
          Recevez les commandes en temps réel, soyez le plus rapide et cumulez vos primes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="text-sm font-medium">
            Nom et prénoms
          </label>
          <input
            id="fullName"
            type="text"
            required
            placeholder="Ex: Kouassi Jean"
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-sm font-medium">
            Numéro de téléphone (MTN / Orange / Moov)
          </label>
          <input
            id="phone"
            type="tel"
            required
            placeholder="Ex: 0505000000"
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Adresse email (pour la connexion)
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="cabiniste@exemple.ci"
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Mot de passe (6 caractères minimum)
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={loading} className="h-12 w-full font-bold">
          <UserPlus className="size-5" />
          {loading ? "Création du compte..." : "Créer mon compte cabiniste"}
        </Button>
      </form>
    </div>
  );
}
