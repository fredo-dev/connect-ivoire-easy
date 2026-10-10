import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startPayment } from "@/lib/payments.functions";
import { profileQuery } from "@/lib/queries";
import { computeFee, formatXOF, OPERATORS, type OperatorId } from "@/lib/fees";

type Props = {
  kind: "forfait" | "recharge";
  planId?: string;
  amount: number;
  operator: OperatorId;
  title: string;
  trigger: React.ReactNode;
  disabled?: boolean;
};

export function PayButton({ kind, planId, amount, operator, title, trigger }: Props) {
  const start = useServerFn(startPayment);
  const { data } = useQuery(profileQuery);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<OperatorId>(operator);
  const [loading, setLoading] = useState(false);
  const { fee, total } = computeFee(amount);

  function onOpen(o: boolean) {
    setOpen(o);
    if (o) {
      setPhone(data?.profile?.phone ?? "+225");
      setMethod((data?.profile?.operator as OperatorId) ?? operator);
    }
  }

  async function pay() {
    setLoading(true);
    try {
      const r = await start({
        data: { kind, planId, amount: kind === "recharge" ? amount : undefined, operator, phone: phone.replace(/\s/g, ""), paymentMethod: method, origin: window.location.origin },
      });
      window.location.href = r.redirectUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Paiement impossible");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Numéro à créditer</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2250701234567" />
          </div>
          <div className="space-y-1.5">
            <Label>Payer avec</Label>
            <div className="grid grid-cols-4 gap-2">
              {OPERATORS.map((o) => (
                <button key={o.id} type="button" onClick={() => setMethod(o.id)}
                  className={`rounded-lg border py-2 text-xs font-medium ${method === o.id ? "border-primary bg-accent text-primary" : "text-muted-foreground"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 rounded-xl bg-muted p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Montant</span><span>{formatXOF(amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Frais de service (1,5 %)</span><span>{formatXOF(fee)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span className="text-primary">{formatXOF(total)}</span></div>
          </div>
          <Button variant="hero" className="h-11 w-full" onClick={pay} disabled={loading}>
            {loading ? "Redirection…" : `Payer ${formatXOF(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
