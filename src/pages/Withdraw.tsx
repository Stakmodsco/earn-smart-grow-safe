import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Withdraw = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const [settings, setSettings] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("app_settings").select("*").then(({ data }) => {
      const m: any = {}; data?.forEach((r: any) => (m[r.key] = r.value)); setSettings(m);
    });
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile || !settings) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center">Loading…</div></div>;

  const min = Number(settings.min_withdrawal);
  const cap = Number((settings.daily_withdrawal_caps as any)[String(profile.level)] ?? 0);

  // 5-day cool-off after the user's most recent approved deposit.
  const lockDays = Number(settings.withdrawal_lock_days ?? 5);
  const lastDeposit = (profile as any).last_deposit_at ? new Date((profile as any).last_deposit_at) : null;
  const unlocksAt = lastDeposit ? new Date(lastDeposit.getTime() + lockDays * 86_400_000) : null;
  const isLocked = unlocksAt ? Date.now() < unlocksAt.getTime() : false;
  const daysLeft = unlocksAt ? Math.max(1, Math.ceil((unlocksAt.getTime() - Date.now()) / 86_400_000)) : 0;

  const submit = async () => {
    if (isLocked) return toast.error(`Withdrawals are available ${lockDays} days after your deposit. Try again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    if (amt < min) return toast.error(`Minimum is $${min}`);
    if (amt > Number(profile.balance)) return toast.error("Insufficient balance");
    if (!details.trim()) return toast.error("Add payout details");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: { amount: amt, payout_method: method, payout_details: details.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Withdrawal submitted — funds locked pending review");
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-2xl py-10">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Withdrawal</div>
        <h1 className="font-display text-4xl font-semibold mb-2">Request a payout</h1>
        <p className="text-muted-foreground mb-8">
          Minimum ${min}. Your daily cap at Level {profile.level} is ${cap}. Funds move to <em>Locked</em> instantly and are released after admin review.
        </p>

        <Card className="glass-card p-6 rounded-xl space-y-5">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Available balance</Label>
            <div className="font-display text-3xl mt-1 tabular-nums">${Number(profile.balance).toFixed(2)}</div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Amount (USD)</Label>
            <Input type="number" step="0.01" min={min} max={Math.min(cap, Number(profile.balance))}
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`min ${min}`} className="mt-2 text-lg" />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payout method</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-2 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="bank">Bank transfer</option>
              <option value="crypto">Crypto (USDT TRC20)</option>
              <option value="mobile_money">Mobile money</option>
            </select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payout details</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500}
              placeholder="Bank: name, account, routing • Crypto: wallet address • Mobile: phone + provider" className="mt-2" />
          </div>

          <Button variant="hero" size="lg" className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit withdrawal"}
          </Button>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

export default Withdraw;
