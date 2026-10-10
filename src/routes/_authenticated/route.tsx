import { createFileRoute, redirect, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Wifi, Smartphone, Receipt, User, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const nav = [
  { to: "/dashboard", label: "Accueil", icon: LayoutDashboard },
  { to: "/forfaits", label: "Forfaits", icon: Wifi },
  { to: "/recharge", label: "Recharge", icon: Smartphone },
  { to: "/transactions", label: "Historique", icon: Receipt },
  { to: "/profil", label: "Profil", icon: User },
] as const;

function Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r p-5 md:flex">
        <span className="font-display text-xl font-bold">Cabine<span className="text-primary">Online</span></span>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${path === to ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted">
          <LogOut className="h-4 w-4" />Déconnexion
        </button>
      </aside>
      <main className="mx-auto w-full max-w-4xl px-5 pb-28 pt-6 md:pb-10 md:pt-10">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 backdrop-blur md:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${path === to ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
