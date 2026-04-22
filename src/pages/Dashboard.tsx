import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowUpRight, Calendar, Coins, Copy, Lock, Play, RefreshCw, Sparkles, TrendingUp, Wallet } from "lucide-react";

type Settings = {
  daily_earning_caps: Record<string, number>;
  level_prices: Record<string, number>;
  daily_task_limits: Record<string, number>;
  task_rewards: Record<string, Record<string, number>>;
  checkin_rewards: Record<string, number>;
  min_withdrawal: number;
};

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { profile, refresh } = useProfile(user?.id);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*");
      if (data) {
        const map: any = {};
        data.forEach((r: any) => { map[r.key] = r.value; });
        setSettings(map as Settings);
      }
    })();
  }, []);

  const loadTxns = async () => {
    if (!user) return;
    const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15);
    setTxns(data ?? []);
  };

  const loadTaskCounts = async () => {
    if (!user) return;
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const { data } = await supabase.from("tasks_log").select("task_type").eq("user_id", user.id).gte("completed_at", start.toISOString());
    const counts: Record<string, number> = {};
    (data ?? []).forEach((r: any) => { counts[r.task_type] = (counts[r.task_type] ?? 0) + 1; });
    setTaskCounts(counts);
  };

  useEffect(() => { loadTxns(); loadTaskCounts(); /* eslint-disable-next-line */ }, [user]);

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile || !settings) return <Loading />;

  const lvl = String(profile.level);
  const cap = Number(settings.daily_earning_caps[lvl] ?? 0);
  const today = new Date().toISOString().slice(0, 10);
  const earnedToday = profile.daily_earned_date === today ? Number(profile.daily_earned) : 0;
  const capPct = cap > 0 ? Math.min(100, (earnedToday / cap) * 100) : 0;

  const canCheckin = !profile.last_checkin || (Date.now() - new Date(profile.last_checkin).getTime() >= 24 * 60 * 60 * 1000);

  const invokeFn = async (fn: string, body: any = {}) => {
    setBusy(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.reward ? `+ $${Number(data.reward).toFixed(2)} earned` : "Done");
      await Promise.all([refresh(), loadTxns(), loadTaskCounts()]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container py-10 max-w-6xl">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary">Dashboard</div>
            <h1 className="font-display text-4xl font-semibold mt-1">Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge>Level {profile.level}</Badge>
            {profile.level < 3 && <Button asChild variant="hero" size="sm"><Link to="/upgrade">Upgrade <ArrowUpRight className="h-4 w-4" /></Link></Button>}
          </div>
        </div>

        {/* Balance row */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <BalanceCard icon={Wallet} label="Available balance" value={profile.balance} accent />
          <BalanceCard icon={Lock} label="Locked (pending)" value={profile.locked_balance} />
          <BalanceCard icon={TrendingUp} label="Total earnings" value={profile.total_earnings} />
        </div>

        {/* Daily progress */}
        <Card className="glass-card p-6 rounded-xl mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium">Daily earning progress</div>
              <div className="text-xs text-muted-foreground">Resets at 00:00 UTC</div>
            </div>
            <div className="text-sm tabular-nums">
              <span className="font-semibold">${earnedToday.toFixed(2)}</span>
              <span className="text-muted-foreground"> / ${cap.toFixed(2)}</span>
            </div>
          </div>
          <Progress value={capPct} className="h-2" />
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Earning actions */}
          <Card className="glass-card p-6 rounded-xl">
            <h3 className="font-display text-xl font-semibold mb-4">Earn today</h3>
            <ActionRow
              icon={Calendar}
              title="Daily check-in"
              subtitle={canCheckin ? `+ $${(settings.checkin_rewards[lvl] ?? 0).toFixed(2)}` : "Available again in 24h"}
              disabled={!canCheckin || busy !== null}
              loading={busy === "checkin"}
              onClick={() => invokeFn("checkin")}
              cta="Check in"
            />
            <ActionRow
              icon={Play}
              title="Watch & Earn"
              subtitle={profile.level >= 1
                ? `+ $${(settings.task_rewards.watch[lvl] ?? 0).toFixed(2)} • ${taskCounts.watch ?? 0}/${settings.daily_task_limits.watch} today`
                : "Unlocks at Level 1"}
              disabled={profile.level < 1 || (taskCounts.watch ?? 0) >= settings.daily_task_limits.watch || busy !== null}
              loading={busy === "complete-task"}
              onClick={() => invokeFn("complete-task", { task_type: "watch" })}
              cta="Watch"
            />
            <ActionRow
              icon={Sparkles}
              title="Spin & Win"
              subtitle={profile.level >= 1
                ? `+ $${(settings.task_rewards.spin[lvl] ?? 0).toFixed(2)} • ${taskCounts.spin ?? 0}/${settings.daily_task_limits.spin} today`
                : "Unlocks at Level 1"}
              disabled={profile.level < 1 || (taskCounts.spin ?? 0) >= settings.daily_task_limits.spin || busy !== null}
              loading={busy === "complete-task"}
              onClick={() => invokeFn("complete-task", { task_type: "spin" })}
              cta="Spin"
            />
          </Card>

          {/* Referral & withdraw */}
          <div className="space-y-6">
            <Card className="glass-card p-6 rounded-xl">
              <h3 className="font-display text-xl font-semibold mb-2">Your referral code</h3>
              <p className="text-sm text-muted-foreground mb-4">Earn 10% on Level-1 referrals' approved upgrades.</p>
              <div className="flex items-center gap-2 bg-secondary/40 rounded-lg p-3 border border-border">
                <code className="font-mono text-lg flex-1 tracking-widest">{profile.referral_code}</code>
                <Button size="sm" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/auth?mode=signup&ref=${profile.referral_code}`);
                  toast.success("Referral link copied");
                }}><Copy className="h-4 w-4" /></Button>
              </div>
              <Button asChild variant="ghost" size="sm" className="w-full mt-3"><Link to="/referrals">View earnings breakdown →</Link></Button>
            </Card>

            <Card className="glass-card p-6 rounded-xl">
              <h3 className="font-display text-xl font-semibold mb-2">Withdraw</h3>
              <p className="text-sm text-muted-foreground mb-4">Minimum ${settings.min_withdrawal}. One request per 24h.</p>
              <Button asChild variant="hero" className="w-full"><Link to="/withdraw">Request withdrawal</Link></Button>
              <Button asChild variant="ghost" size="sm" className="w-full mt-2"><Link to="/requests">View request status →</Link></Button>
            </Card>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <Button asChild variant="outline" className="justify-start h-12"><Link to="/checkin-history">📅 Check-in history</Link></Button>
          <Button asChild variant="outline" className="justify-start h-12"><Link to="/receipts">🧾 Task receipts</Link></Button>
          <Button asChild variant="outline" className="justify-start h-12"><Link to="/requests">📋 My requests</Link></Button>
        </div>

        {/* Transactions */}
        <Card className="glass-card p-6 rounded-xl mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl font-semibold">Recent activity</h3>
            <Button variant="ghost" size="sm" onClick={loadTxns}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          {txns.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">No activity yet — earn your first reward above.</div>
          ) : (
            <div className="divide-y divide-border">
              {txns.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <Coins className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="capitalize">{t.type}{t.notes ? ` · ${t.notes.slice(0, 30)}` : ""}</div>
                      <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`tabular-nums font-medium ${t.type === "withdrawal" ? "text-warning" : "text-primary"}`}>
                      {t.type === "withdrawal" ? "−" : "+"}${Number(t.amount).toFixed(2)}
                    </span>
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const Loading = () => (
  <div className="min-h-screen"><Navbar /><div className="container py-20 text-center text-muted-foreground">Loading…</div></div>
);

const BalanceCard = ({ icon: Icon, label, value, accent }: any) => (
  <Card className={`glass-card p-6 rounded-xl ${accent ? "ring-1 ring-primary/30" : ""}`}>
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Icon className="h-3.5 w-3.5" />{label}</div>
    <div className="font-display text-3xl font-semibold tabular-nums">${Number(value).toFixed(2)}</div>
  </Card>
);

const ActionRow = ({ icon: Icon, title, subtitle, disabled, loading, onClick, cta }: any) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center"><Icon className="h-4 w-4 text-primary" /></div>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
    <Button size="sm" variant="soft" disabled={disabled} onClick={onClick}>{loading ? "…" : cta}</Button>
  </div>
);

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-medium">{children}</span>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/30",
    approved: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-primary/15 text-primary border-primary/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${map[status] ?? "bg-secondary"}`}>{status}</span>;
};

export default Dashboard;
