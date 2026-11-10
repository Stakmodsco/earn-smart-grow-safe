import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";

type Activation = {
  id: string;
  status: "pending" | "confirmed" | "rejected";
  amount_usd: number;
  created_at: string;
  verified_at: string | null;
};

const Upgrade = () => {
  const { user, loading } = useAuth();
  const [activation, setActivation] = useState<Activation | null>(null);
  const [miningActivity, setMiningActivity] = useState<{ status: string; eligible_until: string | null } | null>(null);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    if (!user) return;
    const [a, m] = await Promise.all([
      supabase.from("mining_activations").select("id,status,amount_usd,created_at,verified_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("mining_activity").select("status,eligible_until").eq("user_id", user.id).maybeSingle(),
    ]);
    setActivation(a.data as Activation | null);
    setMiningActivity(m.data);
    setBusy(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const interval = window.setInterval(load, 10_000);
    return () => window.clearInterval(interval);
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const confirmed = activation?.status === "confirmed";
  const pending = activation?.status === "pending";

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-3xl py-10">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
        </Button>

        <div className="text-xs uppercase tracking-widest text-primary mb-2">Mining activation</div>
        <h1 className="font-display text-4xl font-semibold mb-3">Automated mining</h1>
        <p className="text-muted-foreground mb-8">
          Activate your account once. Our server-managed bot system handles eligible reward accrual while you are away.
        </p>

        <Card className="glass-card p-7 rounded-2xl mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-display text-2xl font-semibold">$5 Mining Activator</div>
              <div className="text-sm text-muted-foreground">One-time activation payment</div>
            </div>
          </div>

          {busy ? (
            <div className="text-sm text-muted-foreground">Checking activation…</div>
          ) : confirmed ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-5 w-5" /> Mining Activator confirmed</div>
              <p className="text-sm text-muted-foreground mt-2">Your $5 activation has been verified. Mining eligibility follows your 24-hour sign-in window.</p>
              <div className="text-sm mt-3">Current bot status: <strong>{miningActivity?.status === "active" && miningActivity.eligible_until && new Date(miningActivity.eligible_until).getTime() > Date.now() ? "Active" : "Paused"}</strong></div>
              {miningActivity?.eligible_until && <div className="text-xs text-muted-foreground mt-1">Eligible until {new Date(miningActivity.eligible_until).toLocaleString()}</div>}
            </div>
          ) : pending ? (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-center gap-2 font-semibold"><Clock className="h-5 w-5 text-warning" /> Payment under review</div>
              <p className="text-sm text-muted-foreground mt-2">Your payment proof was submitted. Mining will start only after the payment is independently verified.</p>
              <div className="text-xs text-muted-foreground mt-2">Submitted {new Date(activation.created_at).toLocaleString()}</div>
            </div>
          ) : activation?.status === "rejected" ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-destructive"><XCircle className="h-5 w-5" /> Payment was not approved</div>
              <p className="text-sm text-muted-foreground mt-2">Please review your payment details and submit a new proof. Existing account records remain unchanged.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Your account has not been activated yet. The full $5 is allocated to your individually tracked trading capital after payment verification.</p>
          )}

          {!confirmed && !pending && (
            <Button asChild variant="hero" size="lg" className="w-full mt-6">
              <Link to="/payment/activator">{activation?.status === "rejected" ? "Resubmit Mining Activator" : "Activate for $5"}</Link>
            </Button>
          )}
        </Card>

        <Card className="glass-card p-6 rounded-xl">
          <h2 className="font-display text-xl font-semibold mb-3">How activity works</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Bots operate on the server; your browser does not need to remain open.</li>
            <li>• A successful sign-in keeps your mining eligibility active for 24 hours.</li>
            <li>• If 24 hours pass without another sign-in, mining pauses automatically.</li>
            <li>• Signing in again resumes eligibility; paused time is never credited retroactively.</li>
            <li>• Qualified referrals increase mining speed only. They do not earn direct coin bonuses.</li>
            <li>• Rewards are limited by realized trading proceeds actually available for distribution.</li>
          </ul>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

export default Upgrade;
