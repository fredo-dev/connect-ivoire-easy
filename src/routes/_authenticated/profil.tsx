import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { OPERATORS } from "@/lib/fees";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Profil — Cabine Online" }, { name: "description", content: "Gère ton profil." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: Profil,
});

function Profil() {
  const { data } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const [name, setName] = useState(data.profile?.full_name ?? "");
  const [phone, setPhone] = useState(data.profile?.phone ?? "+225");
  const [op, setOp] = useState(data.profile?.operator ?? "orange");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const p = phone.replace(/\s/g, "");
    if (!/^\+225\d{10}$/.test(p)) return toast.error("Numéro au format +225 suivi de 10 chiffres");
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ id: data.id, full_name: name, phone: p, operator: op, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error("Enregistrement impossible");
    toast.success("Profil enregistré");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-5">
      <h1 className="text-2xl font-bold md:text-3xl">Profil</h1>
      <p className="text-sm text-muted-foreground">{data.email}</p>
      <div className="space-y-1.5"><Label>Nom complet</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2250701234567" /></div>
      <div className="space-y-1.5">
        <Label>Opérateur</Label>
        <div className="grid grid-cols-4 gap-2">
          {OPERATORS.map((o) => (
            <button type="button" key={o.id} onClick={() => setOp(o.id)} className={`rounded-xl border py-2.5 text-sm ${op === o.id ? "border-primary bg-accent text-primary" : "text-muted-foreground"}`}>{o.label}</button>
          ))}
        </div>
      </div>
      <Button type="submit" variant="hero" className="h-11 w-full" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}
