import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatXOF, operatorLabel } from "@/lib/fees";
import { QuizAdmin } from "@/components/QuizAdmin";
import { pageMeta } from "@/lib/page-meta";
import { listAdminPlans, saveAdminPlan, deleteAdminPlan } from "@/lib/admin-plans.functions";
import { Button } from "@/components/ui/button";

type Plan = {
  id?: string;
  operator: "orange" | "mtn" | "moov";
  kind: "internet" | "appels" | "mixte";
  name: string;
  description: string;
  validity: string;
  price: number;
  active: boolean;
};

const emptyPlan: Plan = {
  operator: "orange",
  kind: "internet",
  name: "",
  description: "",
  validity: "30 jours",
  price: 1000,
  active: true,
};

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => pageMeta("Gestion des opérations — Cabine Online", "Suivi des opérations, des forfaits et des lots par le gérant."),
  component: Admin,
});

const filters = [["all", "Toutes"], ["success", "Réussies"], ["pending", "En attente"], ["error", "Échouées"]] as const;

function Admin() {
  const qc = useQueryClient();
  const [f, setF] = useState<string>("all");
  const [section, setSection] = useState<"operations" | "quiz" | "plans">("operations");
  const [editing, setEditing] = useState<Plan | null>(null);

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

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-plans"],
    enabled: !!isAdmin,
    queryFn: () => listAdminPlans(),
  });

  if (l1) return <p className="text-muted-foreground">Chargement…</p>;
  if (!isAdmin) return <p className="text-muted-foreground">Accès réservé aux gérants.</p>;

  const list = f === "all" ? txs : txs.filter((t) => t.status === f);
  const ok = txs.filter((t) => t.status === "success");
  const stats = [
    ["Encaissement", formatXOF(ok.reduce((s, t) => s + t.total, 0))],
    ["Frais gagnés", formatXOF(ok.reduce((s, t) => s + t.fee, 0))],
    ["Recharges à envoyer", String(ok.filter((t) => t.kind === "recharge").length)],
    ["En attente", String(txs.filter((t) => t.status === "pending").length)],
  ];

  async function handleSavePlan(form: Plan) {
    await saveAdminPlan({
      data: {
        id: form.id,
        operator: form.operator,
        kind: form.kind,
        name: form.name,
        description: form.description,
        validity: form.validity,
        price: Number(form.price),
        active: form.active,
      },
    });
    await qc.invalidateQueries({ queryKey: ["admin-plans"] });
    setEditing(null);
  }

  async function handleDeletePlan(id: string) {
    await deleteAdminPlan({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["admin-plans"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="pr-12 text-2xl font-bold md:text-3xl">Gestion des opérations</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-lg font-bold">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b" role="tablist" aria-label="Sections de gestion">
        <button role="tab" aria-selected={section === "operations"} onClick={() => setSection("operations")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "operations" ? "border-primary text-primary" : "text-muted-foreground"}`}>
          Opérations
        </button>
        <button role="tab" aria-selected={section === "quiz"} onClick={() => setSection("quiz")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "quiz" ? "border-primary text-primary" : "text-muted-foreground"}`}>
          Quiz
        </button>
        <button role="tab" aria-selected={section === "plans"} onClick={() => setSection("plans")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "plans" ? "border-primary text-primary" : "text-muted-foreground"}`}>
          Forfaits
        </button>
      </div>

      {section === "plans" && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">Ajouter / modifier un forfait</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                value={editing?.operator ?? emptyPlan.operator}
                onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), operator: e.target.value as Plan["operator"] }))}
                className="rounded-xl border bg-background p-3"
              >
                <option value="orange">Orange CI</option>
                <option value="mtn">MTN CI</option>
                <option value="moov">Moov Africa CI</option>
              </select>

              <select
                value={editing?.kind ?? emptyPlan.kind}
                onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), kind: e.target.value as Plan["kind"] }))}
                className="rounded-xl border bg-background p-3"
              >
                <option value="internet">Internet</option>
                <option value="appels">Appels</option>
                <option value="mixte">Mixte</option>
              </select>

              <input
                value={editing?.name ?? ""}
                onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), name: e.target.value }))}
                placeholder="Nom du pass"
                className="rounded-xl border bg-background p-3"
              />

              <input
                value={editing?.price ?? 1000}
                type="number"
                min={100}
                onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), price: Number(e.target.value) }))}
                placeholder="Prix"
                className="rounded-xl border bg-background p-3"
              />

              <input
                value={editing?.validity ?? ""}
                onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), validity: e.target.value }))}
                placeholder="Validité"
                className="rounded-xl border bg-background p-3"
              />

              <input
                value={editing?.description ?? ""}
                onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), description: e.target.value }))}
                placeholder="Description"
                className="rounded-xl border bg-background p-3 md:col-span-2"
              />

              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={editing?.active ?? true}
                  onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), active: e.target.checked }))}
                />
                <span>Actif</span>
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => handleSavePlan(editing ?? { ...emptyPlan, name: "Nouveau forfait", description: "Description" })}
              >
                Enregistrer
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Nouveau
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">Forfaits disponibles</h2>
            <div className="space-y-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.operator} · {plan.kind} · {plan.validity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatXOF(plan.price)}</p>
                      <p className="text-xs text-muted-foreground">{plan.active ? "Actif" : "Inactif"}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(plan)}>
                      Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeletePlan(plan.id)}>
                      Supprimer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSavePlan({ ...plan, active: !plan.active })}>
                      {plan.active ? "Désactiver" : "Activer"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === "quiz" && <QuizAdmin />}

      {section === "operations" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {filters.map(([id, l]) => (
              <button key={id} onClick={() => setF(id)} className={`rounded-full border px-3.5 py-1.5 text-sm ${f === id ? "border-primary text-primary" : "text-muted-foreground"}`}>
                {l}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Chargement…</p>
          ) : (
            <div className="divide-y rounded-2xl border bg-card">
              {list.length === 0 && <p className="p-5 text-sm text-muted-foreground">Aucune opération.</p>}
              {list.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{t.label} · {operatorLabel(t.operator)}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.phone} · payé via {operatorLabel(t.payment_method)} · {new Date(t.created_at).toLocaleString("fr-FR")} · {t.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatXOF(t.total)}</p>
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
