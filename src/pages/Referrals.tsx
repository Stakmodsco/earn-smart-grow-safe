import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpRight, Calendar, CheckCircle2, MinusCircle, Play, Sparkles, TrendingUp, Users, X } from "lucide-react";

const Referrals = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const [refs, setRefs] = useState<any[]>([]);
  const [refTxns, setRefTxns] = useState<any[]>([]);
  const [cap, setCap] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const start = new Date(); start.setUTCHours(0, 0, 0, 0);
      const [r, t, s] = await Promise.all([
        supabase.from("referrals").select("*, child:profiles!referrals_child_user_fkey(email, full_name, level)").eq("parent_user", user.id),
        supabase.from("transactions").select("*").eq("user_id", user.id).eq("type", "referral").order("created_at", { ascending: false }).limit(50),
        supabase.from("app_settings").select("value").eq("key", "daily_referral_cap").maybeSingle(),
      ]);
      setRefs(r.data ?? []);
      setRefTxns(t.data ?? []);
      const lvl = String(profile?.level ?? 0);
      setCap(Number((s.data?.value as any)?.[lvl] ?? 0));
    })();
  }, [user, profile?.level]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center">Loading…</div></div>;

  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const todayEarned = refTxns.filter(t => t.status === "completed" && new Date(t.created_at) >= start)
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalEarned = refTxns.filter(t => t.status === "completed").reduce((s, t) => s + Number(t.amount), 0);
  const remaining = Math.max(0, cap - todayEarned);

  const l1 = refs.filter(r => r.depth === 1);
  const l2 = refs.filter(r => r.depth === 2);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container py-10 max-w-5xl">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Referrals</div>
        <h1 className="font-display text-4xl font-semibold mb-8">Your network earnings</h1>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Stat icon={Users} label="Level 1 referrals" value={l1.length.toString()} />
          <Stat icon={Users} label="Level 2 referrals" value={l2.length.toString()} />
          <Stat icon={TrendingUp} label="Total commission" value={`$${totalEarned.toFixed(2)}`} accent />
          <Stat icon={Calendar} label="Daily cap remaining" value={`$${remaining.toFixed(2)} / $${cap.toFixed(2)}`} />
        </div>

        <Card className="glass-card p-6 rounded-xl mb-6">
          <h3 className="font-display text-xl font-semibold mb-4">Commission breakdown</h3>
          {refTxns.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              No referral commissions yet. Share your code <span className="font-mono text-primary">{profile.referral_code}</span> to start earning.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {refTxns.map((t) => {
                const isCompleted = t.status === "completed";
                const isCapped = t.status === "rejected";
                return (
                  <div key={t.id} className="py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      {isCompleted ? <CheckCircle2 className="h-4 w-4 text-primary" />
                        : isCapped ? <MinusCircle className="h-4 w-4 text-warning" />
                        : <X className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <div>{t.notes || "Referral commission"}</div>
                        <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className={`tabular-nums font-medium ${isCompleted ? "text-primary" : isCapped ? "text-warning" : "text-muted-foreground"}`}>
                      {isCompleted ? `+ $${Number(t.amount).toFixed(2)}` : `$${Number(t.amount).toFixed(2)} ${isCapped ? "(capped)" : ""}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <RefList title="Level 1 (10% commission)" rows={l1} />
          <RefList title="Level 2 (3% commission)" rows={l2} />
        </div>

        <div className="mt-6 flex gap-2">
          <Button asChild variant="outline"><Link to="/dashboard">← Dashboard</Link></Button>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, accent }: any) => (
  <Card className={`glass-card p-5 rounded-xl ${accent ? "ring-1 ring-primary/30" : ""}`}>
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Icon className="h-3.5 w-3.5" />{label}</div>
    <div className="font-display text-2xl font-semibold tabular-nums">{value}</div>
  </Card>
);

const RefList = ({ title, rows }: { title: string; rows: any[] }) => (
  <Card className="glass-card p-6 rounded-xl">
    <h3 className="font-medium mb-4">{title}</h3>
    {rows.length === 0 ? <div className="text-sm text-muted-foreground">None yet.</div> : (
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.id} className="py-2.5 flex items-center justify-between text-sm">
            <div>
              <div>{r.child?.full_name || r.child?.email || "—"}</div>
              <div className="text-xs text-muted-foreground">Joined {new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">L{r.child?.level ?? 0}</span>
          </div>
        ))}
      </div>
    )}
  </Card>
);

export default Referrals;
