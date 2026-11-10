import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatXOF, operatorLabel } from "@/lib/fees";
import { QuizAdmin } from "@/components/QuizAdmin";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => pageMeta("Gestion des opérations — Cabine Online", "Suivi des opérations, des versements du quiz et des lots par le gérant."),
  component: Admin,
});

const filters = [["all", "Toutes"], ["success", "Réussies"], ["pending", "En attente"], ["error", "Échouées"]] as const;

function Admin() {
  const [f, setF] = useState<string>("all");
  const [section, setSection] = useState<"operations" | "quiz">("operations");
  const { data: isAdmin, isLoading: l1 } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
      return !!data;
    },
  });
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  if (l1) return <p className="text-muted-foreground">Chargement…</p>;
  if (!isAdmin) return <p className="text-muted-foreground">Accès réservé aux gérants.</p>;

  const list = f === "all" ? txs : txs.filter((t) => t.status === f);
  const ok = txs.filter((t) => t.status === "success");
  const stats = [
    ["Encaissé", formatXOF(ok.reduce((s, t) => s + t.total, 0))],
    ["Frais gagnés", formatXOF(ok.reduce((s, t) => s + t.fee, 0))],
    ["Recharges à envoyer", String(ok.filter((t) => t.kind === "recharge").length)],
    ["En attente", String(txs.filter((t) => t.status === "pending").length)],
  ];

  return (
    <div className="space-y-6">
      <h1 className="pr-12 text-2xl font-bold md:text-3xl">Gestion des opérations</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 font-display text-lg font-bold">{v}</p></div>
        ))}
      </div>
      <div className="flex gap-2 border-b" role="tablist" aria-label="Sections de gestion">
        <button role="tab" aria-selected={section === "operations"} onClick={() => setSection("operations")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "operations" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Opérations</button>
        <button role="tab" aria-selected={section === "quiz"} onClick={() => setSection("quiz")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "quiz" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Quiz, versements & lots</button>
      </div>
      {section === "quiz" ? <QuizAdmin /> : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {filters.map(([id, l]) => (
              <button key={id} onClick={() => setF(id)} className={`rounded-full border px-3.5 py-1.5 text-sm ${f === id ? "border-primary text-primary" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
          {isLoading ? <p className="text-muted-foreground">Chargement…</p> : (
            <div className="divide-y rounded-2xl border bg-card">
              {list.length === 0 && <p className="p-5 text-sm text-muted-foreground">Aucune opération.</p>}
              {list.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{t.label} · {operatorLabel(t.operator)}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.phone} · payé via {operatorLabel(t.payment_method)} · {new Date(t.created_at).toLocaleString("fr-FR")} · {t.reference}</p>
                  </div>
                  <div className="text-right"><p className="font-semibold">{formatXOF(t.total)}</p><StatusBadge status={t.status} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
