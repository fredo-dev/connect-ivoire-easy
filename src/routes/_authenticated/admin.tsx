import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle, PlusCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatXOF, operatorLabel } from "@/lib/fees";
import { QuizAdmin } from "@/components/QuizAdmin";
import { pageMeta } from "@/lib/page-meta";
import { listAdminPlans, saveAdminPlan, deleteAdminPlan } from "@/lib/admin-plans.functions";
import { approveCabiniste, listAllCabinistes, topUpCabinisteStock } from "@/lib/cabiniste.functions";
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
  const [section, setSection] = useState<"operations" | "quiz" | "plans" | "cabinistes">("operations");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [busyCabId, setBusyCabId] = useState<string | null>(null);

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

  const { data: cabinistes = [] } = useQuery({
    queryKey: ["admin-cabinistes"],
    enabled: !!isAdmin,
    queryFn: () => listAllCabinistes(),
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

  async function handleApproveCab(targetUserId: string, approve: boolean) {
    setBusyCabId(targetUserId);
    try {
      await approveCabiniste({ data: { targetUserId, approve } });
      await qc.invalidateQueries({ queryKey: ["admin-cabinistes"] });
      toast.success(approve ? "Cabiniste validé !" : "Cabiniste suspendu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusyCabId(null);
    }
  }

  async function handleTopUpCab(targetUserId: string, fullName: string) {
    const raw = window.prompt(`Montant à ajouter au stock de ${fullName} (FCFA) :`, "15000");
    if (!raw) return;
    const amount = Number(raw);
    if (isNaN(amount) || amount < 1000) return toast.error("Montant minimum : 1 000 FCFA");
    setBusyCabId(targetUserId);
    try {
      await topUpCabinisteStock({ data: { targetUserId, amount } });
      await qc.invalidateQueries({ queryKey: ["admin-cabinistes"] });
      toast.success(`+${formatXOF(amount)} ajoutés au stock de ${fullName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recharge impossible");
    } finally {
      setBusyCabId(null);
    }
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

      <div className="flex gap-2 overflow-x-auto border-b" role="tablist" aria-label="Sections de gestion">
        <button role="tab" aria-selected={section === "operations"} onClick={() => setSection("operations")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "operations" ? "border-primary text-primary" : "text-muted-foreground"}`}>
          Opérations
        </button>
        <button role="tab" aria-selected={section === "cabinistes"} onClick={() => setSection("cabinistes")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "cabinistes" ? "border-primary text-primary" : "text-muted-foreground"}`}>
          Cabinistes ({cabinistes.length})
        </button>
        <button role="tab" aria-selected={section === "quiz"} onClick={() => setSection("quiz")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "quiz" ? "border-primary text-primary" : "text-muted-foreground"}`}>
          Quiz
        </button>
        <button role="tab" aria-selected={section === "plans"} onClick={() => setSection("plans")} className={`border-b-2 px-4 py-3 text-sm font-medium ${section === "plans" ? "border-primary text-primary" : "text-muted-foreground"}`}>
          Forfaits
        </button>
      </div>

      {section === "cabinistes" && (
        <div className="space-y-3">
          {cabinistes.length === 0 ? (
            <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucun cabiniste inscrit pour le moment.
            </p>
          ) : (
            cabinistes.map((cab) => (
              <div key={cab.user_id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{cab.full_name}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cab.is_approved ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {cab.is_approved ? "Validé" : "En attente"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Tél : {cab.phone}</p>
                  <p className="text-sm">
                    Stock : <strong className="text-primary">{formatXOF(cab.stock)}</strong> • Primes : <strong className="text-success">{formatXOF(cab.bonuses)}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={busyCabId === cab.user_id} onClick={() => handleTopUpCab(cab.user_id, cab.full_name)}>
                    <PlusCircle className="mr-1 size-4" /> Recharger
                  </Button>
                  {!cab.is_approved ? (
                    <Button size="sm" className="bg-success text-primary-foreground hover:bg-success/90" disabled={busyCabId === cab.user_id} onClick={() => handleApproveCab(cab.user_id, true)}>
                      <CheckCircle className="mr-1 size-4" /> Valider
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="border-destructive/40 text-destructive" disabled={busyCabId === cab.user_id} onClick={() => handleApproveCab(cab.user_id, false)}>
                      <ShieldAlert className="mr-1 size-4" /> Suspendre
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {section === "plans" && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">Ajouter / modifier un forfait</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <select value={editing?.operator ?? emptyPlan.operator} onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), operator: e.target.value as Plan["operator"] }))} className="rounded-xl border bg-background p-3">
                <option value="orange">Orange CI</option>
                <option value="mtn">MTN CI</option>
                <option value="moov">Moov Africa CI</option>
              </select>
              <select value={editing?.kind ?? emptyPlan.kind} onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), kind: e.target.value as Plan["kind"] }))} className="rounded-xl border bg-background p-3">
                <option value="internet">Internet</option>
                <option value="appels">Appels</option>
                <option value="mixte">Mixte</option>
              </select>
              <input value={editing?.name ?? ""} onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), name: e.target.value }))} placeholder="Nom du pass" className="rounded-xl border bg-background p-3" />
              <input value={editing?.price ?? 1000} type="number" min={100} onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), price: Number(e.target.value) }))} placeholder="Prix" className="rounded-xl border bg-background p-3" />
              <input value={editing?.validity ?? ""} onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), validity: e.target.value }))} placeholder="Validité" className="rounded-xl border bg-background p-3" />
              <input value={editing?.description ?? ""} onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), description: e.target.value }))} placeholder="Description" className="rounded-xl border bg-background p-3 md:col-span-2" />
              <label className="flex items-center gap-2 md:col-span-2">
                <input type="checkbox" checked={editing?.active ?? true} onChange={(e) => setEditing((prev) => ({ ...(prev ?? emptyPlan), active: e.target.checked }))} />
                <span>Actif</span>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => handleSavePlan(editing ?? { ...emptyPlan, name: "Nouveau forfait", description: "Description" })}>Enregistrer</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Nouveau</Button>
            </div>
          </div>

          <div className="space-y-2">
            {plans.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
                <div>
                  <p className="font-medium">{p.name} ({operatorLabel(p.operator)})</p>
                  <p className="text-xs text-muted-foreground">{formatXOF(p.price)} • {p.validity}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Modifier</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeletePlan(p.id)}>Supprimer</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "quiz" && <QuizAdmin />}

      {section === "operations" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filters.map(([id, label]) => (
              <button key={id} onClick={() => setF(id)} className={`rounded-full border px-3.5 py-1.5 text-sm ${f === id ? "border-primary bg-accent text-primary" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement des opérations…</p>
          ) : (
            <div className="space-y-2">
              {list.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border bg-card p-3.5 text-sm">
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.phone} • {new Date(t.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatXOF(t.total)}</p>
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

