import { createFileRoute, Link } from "@tanstack/react-router";
import { Wifi, PhoneCall, Smartphone, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cabine Online — Forfaits et recharges en Côte d'Ivoire" },
      { name: "description", content: "Achète tes forfaits internet et appels Orange, MTN, Moov, Wave et recharge ton crédit par Mobile Money." },
      { property: "og:title", content: "Cabine Online — Forfaits et recharges" },
      { property: "og:description", content: "Forfaits et recharges payés par Mobile Money en quelques secondes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const ops = [
  { name: "Orange", cls: "bg-orange-op" },
  { name: "MTN", cls: "bg-mtn-op" },
  { name: "Moov", cls: "bg-moov-op" },
  { name: "Wave", cls: "bg-wave-op" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl font-bold">Cabine<span className="text-primary">Online</span></span>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/inscription-cabiniste">
              <Store className="mr-1.5 size-4" /> Devenir cabiniste
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/auth">Connexion</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:pt-20">
        <p className="mb-4 inline-flex rounded-full border px-3 py-1 text-xs text-muted-foreground">🇨🇮 Ta cabine, partout, 24h/24</p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
          Forfaits et crédit, <span className="text-primary">payés en Mobile Money</span>.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Choisis ton forfait internet ou appels, paie avec Orange Money, MTN, Moov ou Wave. Frais de service : 1,5 % seulement.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="hero" size="lg">
            <Link to="/auth">Commencer</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/inscription-cabiniste">
              <Store className="mr-2 size-5" /> Inscription Cabiniste
            </Link>
          </Button>
        </div>
        <div className="mt-10 flex flex-wrap gap-2">
          {ops.map((o) => (
            <span key={o.name} className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${o.cls}`} />{o.name}
            </span>
          ))}
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {[
            { i: Wifi, t: "Forfaits internet", d: "Du pass jour au pass mois." },
            { i: PhoneCall, t: "Forfaits appels", d: "Des minutes vers tous réseaux." },
            { i: Smartphone, t: "Recharge crédit", d: "Le montant de ton choix." },
            { i: ShieldCheck, t: "Paiement sécurisé", d: "Via Jèko, en Mobile Money." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border bg-card/60 p-5">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
