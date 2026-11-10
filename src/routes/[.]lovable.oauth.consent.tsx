import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pageMeta } from "@/lib/page-meta";

type Details = { client?: { name?: string; redirect_uri?: string }; scope?: string; redirect_url?: string; redirect_to?: string } | null;
type Res = { data: Details; error: { message: string } | null };
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails(id: string): Promise<Res>;
    approveAuthorization(id: string): Promise<Res>;
    denyAuthorization(id: string): Promise<Res>;
  };
}).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
  }),
  head: () => pageMeta("Autoriser une application — Cabine Online", "Autorise un assistant à accéder à ton compte Cabine Online."),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Demande d'autorisation invalide (identifiant manquant).");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? "" };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-sm rounded-3xl border bg-card p-7 text-center">
        <h1 className="text-xl font-bold">Autorisation impossible</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message ?? "Demande expirée ou invalide."}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const name = details?.client?.name ?? "Une application";

  async function decide(approve: boolean) {
    setBusy(true); setErr(null);
    const { data, error } = approve ? await oauth.approveAuthorization(authorization_id) : await oauth.denyAuthorization(authorization_id);
    const target = data?.redirect_url ?? data?.redirect_to;
    if (error || !target) { setBusy(false); setErr(error?.message ?? "Aucune redirection reçue."); return; }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-hero px-5">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-7">
        <h1 className="text-xl font-bold">Connecter {name} à Cabine Online</h1>
        <p className="mt-2 text-sm text-muted-foreground">Connecté en tant que {email}</p>
        {details?.client?.redirect_uri && <p className="mt-1 break-all text-xs text-muted-foreground">{details.client.redirect_uri}</p>}
        <p className="mt-4 text-sm">{name} pourra utiliser l'application en ton nom : consulter les forfaits, ton profil et ton historique de paiements.</p>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
          <li>Partager ton profil de base</li>
          <li>Partager ton adresse email</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Cela ne contourne pas les règles d'accès de l'application.</p>
        {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>Annuler</Button>
          <Button variant="hero" className="flex-1" disabled={busy} onClick={() => decide(true)}>Autoriser</Button>
        </div>
      </div>
    </main>
  );
}
