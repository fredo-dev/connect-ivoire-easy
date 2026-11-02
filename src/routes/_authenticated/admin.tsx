import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatXOF, operatorLabel, OPERATORS } from "@/lib/fees";
import {
  adminListPlans, adminListUsers, adminSavePlan, adminSetRole, adminUpdateTransaction,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Espace gérant — Cabine Online" },
      { name: "description", content: "Valider les opérations, gérer les forfaits et les comptes." },
      { property: "og:title", content: "Espace gérant — Cabine Online" },
      { property: "og:description", content: "Valider les opérations, gérer les forfaits et les comptes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

const tabs = [["ops", "Opérations"], ["plans", "Forfaits"], ["users", "Comptes"]] as const;

function Admin() {
  const [tab, setTab] = useState<string>("ops");
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
      return !!data;
    },
  });
  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (!isAdmin) return <p className="text-muted-foreground">Accès réservé aux gérants.</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Espace gérant</h1>
      <div className="flex gap-2 border-b">
        {tabs.map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {tab === "ops" && <Operations />}
      {tab === "plans" && <Plans />}
      {tab === "users" && <Users />}
    </div>
  );
}

const filters = [["todo", "À traiter"], ["all", "Toutes"], ["success", "Payées"], ["pending", "En attente"], ["error", "Échouées"], ["done", "Validées"]] as const;

function Operations() {
  const qc = useQueryClient();
  const update = useServerFn(adminUpdateTransaction);
  const [f, setF] = useState<string>("todo");
  const [busy, setBusy] = useState<string | null>(null);
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data as any[];
    },
  });
  const act = async (id: string, action: "deliver" | "undeliver" | "success" | "error") => {
    if (action === "error" && !confirm("Marquer cette opération comme échouée ?")) return;
    setBusy(id);
    try {
      await update({ data: { id, action } });
      toast.success("Opération mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-transactions"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const list = txs.filter((t) =>
    f === "all" ? true : f === "todo" ? t.status === "success" && !t.delivered_at : f === "done" ? !!t.delivered_at : t.status === f);
  const ok = txs.filter((t) => t.status === "success");
  const stats = [
    ["Encaissé", formatXOF(ok.reduce((s, t) => s + t.total, 0))],
    ["Frais gagnés", formatXOF(ok.reduce((s, t) => s + t.fee, 0))],
    ["À traiter", String(ok.filter((t) => !t.delivered_at).length)],
    ["En attente de paiement", String(txs.filter((t) => t.status === "pending").length)],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 font-display text-lg font-bold">{v}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map(([id, l]) => (
          <button key={id} onClick={() => setF(id)} className={`rounded-full border px-3.5 py-1.5 text-sm ${f === id ? "border-primary text-primary" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {isLoading ? <p className="text-muted-foreground">Chargement…</p> : (
        <div className="divide-y rounded-2xl border bg-card">
          {list.length === 0 && <p className="p-5 text-sm text-muted-foreground">Aucune opération.</p>}
          {list.map((t) => (
            <div key={t.id} className="flex flex-col gap-3 p-4 text-sm md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{t.label} · {operatorLabel(t.operator)}</p>
                <p className="text-base font-semibold text-primary">{t.phone}</p>
                <p className="truncate text-xs text-muted-foreground">payé via {operatorLabel(t.payment_method)} · {new Date(t.created_at).toLocaleString("fr-FR")} · {t.reference}</p>
                {t.delivered_at && <p className="text-xs text-success">Validée le {new Date(t.delivered_at).toLocaleString("fr-FR")}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <div className="mr-2 text-right"><p className="font-semibold">{formatXOF(t.total)}</p><StatusBadge status={t.status} /></div>
                {t.status === "success" && !t.delivered_at && (
                  <button disabled={busy === t.id} onClick={() => act(t.id, "deliver")} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Valider (envoyé)</button>
                )}
                {t.delivered_at && (
                  <button disabled={busy === t.id} onClick={() => act(t.id, "undeliver")} className="rounded-xl border px-3 py-2 text-xs">Annuler validation</button>
                )}
                {t.status === "pending" && (
                  <>
                    <button disabled={busy === t.id} onClick={() => act(t.id, "success")} className="rounded-xl border border-primary px-3 py-2 text-xs text-primary">Confirmer paiement</button>
                    <button disabled={busy === t.id} onClick={() => act(t.id, "error")} className="rounded-xl border px-3 py-2 text-xs text-destructive">Échouée</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Plan = { id?: string; operator: "orange" | "mtn" | "moov" | "wave"; kind: string; name: string; description: string; validity: string; price: number; active: boolean };
const emptyPlan: Plan = { operator: "orange", kind: "internet", name: "", description: "", validity: "", price: 1000, active: true };

function Plans() {
  const list = useServerFn(adminListPlans);
  const save = useServerFn(adminSavePlan);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Plan | null>(null);
  const { data: plans = [], isLoading } = useQuery({ queryKey: ["admin-plans"], queryFn: () => list() });
  const submit = async (p: Plan) => {
    try {
      await save({ data: p as any });
      toast.success("Forfait enregistré");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="space-y-4">
      <button onClick={() => setEdit({ ...emptyPlan })} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">+ Nouveau forfait</button>
      {edit && <PlanForm plan={edit} onCancel={() => setEdit(null)} onSave={submit} />}
      {isLoading ? <p className="text-muted-foreground">Chargement…</p> : (
        <div className="divide-y rounded-2xl border bg-card">
          {plans.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className={`font-medium ${p.active ? "" : "text-muted-foreground line-through"}`}>{p.name} · {operatorLabel(p.operator)}</p>
                <p className="truncate text-xs text-muted-foreground">{p.kind} · {p.validity} · {p.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatXOF(p.price)}</span>
                <button onClick={() => submit({ ...(p as Plan), active: !p.active })} className="rounded-xl border px-3 py-1.5 text-xs">{p.active ? "Désactiver" : "Activer"}</button>
                <button onClick={() => setEdit(p as Plan)} className="rounded-xl border px-3 py-1.5 text-xs">Modifier</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanForm({ plan, onSave, onCancel }: { plan: Plan; onSave: (p: Plan) => void; onCancel: () => void }) {
  const [p, setP] = useState<Plan>(plan);
  const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(p); }} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2">
      <label className="text-xs text-muted-foreground">Opérateur
        <select className={input} value={p.operator} onChange={(e) => setP({ ...p, operator: e.target.value as Plan["operator"] })}>
          {OPERATORS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Type
        <select className={input} value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value })}>
          {["internet", "appels", "mixte", "fibre", "homebox"].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Nom<input required className={input} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
      <label className="text-xs text-muted-foreground">Validité<input required className={input} value={p.validity} onChange={(e) => setP({ ...p, validity: e.target.value })} placeholder="30 jours" /></label>
      <label className="text-xs text-muted-foreground">Prix (FCFA)<input required type="number" min={50} className={input} value={p.price} onChange={(e) => setP({ ...p, price: Number(e.target.value) })} /></label>
      <label className="text-xs text-muted-foreground md:col-span-2">Description<input className={input} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Visible pour les clients</label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm">Annuler</button>
        <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Enregistrer</button>
      </div>
    </form>
  );
}

function Users() {
  const list = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetRole);
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  const toggle = async (userId: string, admin: boolean) => {
    try {
      await setRole({ data: { userId, admin } });
      toast.success(admin ? "Accès gérant donné" : "Accès gérant retiré");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) { toast.error((e as Error).message); }
  };
  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {users.map((u: { id: string; email: string; name: string | null; phone: string | null; isAdmin: boolean; createdAt: string }) => (
        <div key={u.id} className="flex items-center justify-between gap-3 p-4 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{u.name || u.email} {u.isAdmin && <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Gérant</span>}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email} · {u.phone ?? "sans numéro"} · inscrit le {new Date(u.createdAt).toLocaleDateString("fr-FR")}</p>
          </div>
          <button onClick={() => toggle(u.id, !u.isAdmin)} className="rounded-xl border px-3 py-1.5 text-xs">{u.isAdmin ? "Retirer gérant" : "Rendre gérant"}</button>
        </div>
      ))}
    </div>
  );
}
