import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  Headphones,
  ListChecks,
  Lock,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Icon3D, Icon3DName } from "@/components/Icon3D";

type Settings = {
  daily_earning_caps: Record<string, number>;
  daily_task_limits: Record<string, number>;
  task_rewards: Record<string, Record<string, number>>;
  checkin_rewards: Record<string, number>;
  level_prices: Record<string, number>;
  min_withdrawal: number;
};

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const { format, meta } = useCurrency();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    supabase.from("app_settings").select("*").then(({ data }) => {
      const m: any = {}; data?.forEach((r: any) => (m[r.key] = r.value)); setSettings(m as Settings);
    });
  }, []);

  // Calculate streak from check-in logs
  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(); since.setUTCDate(since.getUTCDate() - 30);
      const { data } = await supabase
        .from("tasks_log")
        .select("completed_at")
        .eq("user_id", user.id)
        .eq("task_type", "checkin")
        .gte("completed_at", since.toISOString())
        .order("completed_at", { ascending: false });
      const days = new Set((data ?? []).map((r: any) => new Date(r.completed_at).toISOString().slice(0, 10)));
      let s = 0;
      const cursor = new Date();
      for (let i = 0; i < 30; i++) {
        const key = cursor.toISOString().slice(0, 10);
        if (days.has(key)) { s += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
        else break;
      }
      setStreak(s);
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile || !settings) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center text-muted-foreground">Loading…</div><BottomNav /></div>;

  const lvl = String(profile.level);
  const cap = Number(settings.daily_earning_caps?.[lvl] ?? 0);
  const today = new Date().toISOString().slice(0, 10);
  const earnedToday = profile.daily_earned_date === today ? Number(profile.daily_earned) : 0;
  const capPct = cap > 0 ? Math.min(100, (earnedToday / cap) * 100) : 0;
  const firstName = profile.full_name?.split(" ")[0] ?? "there";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const tiles: { id: string; icon: Icon3DName; title: string; unlock: number }[] = [
    { id: "watch", icon: "play", title: "Watch & Earn", unlock: 1 },
    { id: "checkin", icon: "calendar", title: "Daily Check-in", unlock: 0 },
    { id: "spin", icon: "sparkles", title: "Spin & Win", unlock: 1 },
    { id: "hookup", icon: "link", title: "Connect", unlock: 2 },
    { id: "vip", icon: "crown", title: "VIP Stream", unlock: 3 },
    { id: "creator", icon: "userplus", title: "Creator", unlock: 3 },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container py-8 max-w-5xl">
        {/* Greeting + streak */}
        <Card className="glass-card p-5 rounded-xl mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">{greeting}, {firstName}!</h1>
            <p className="text-sm text-muted-foreground">Let's earn today 🚀</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/15 border border-warning/30 text-warning text-sm font-medium">
            <Flame className="h-4 w-4" /> {streak}-Day Streak
          </div>
        </Card>

        {/* Balance hero */}
        <Card className="rounded-xl p-6 mb-5 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground shadow-emerald">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest opacity-80">Balance</div>
              <div className="font-display text-5xl font-semibold mt-2 tabular-nums">
                {showBalance ? format(profile.balance) : `${meta.symbol} • • • •`}
              </div>
            </div>
            <button onClick={() => setShowBalance((v) => !v)} className="h-10 w-10 grid place-items-center rounded-lg bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors" aria-label="Toggle balance">
              {showBalance ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs opacity-90 mb-2">
              <span>Account Level: {profile.level}</span>
              <span className="tabular-nums">
                {showBalance ? `${format(earnedToday)} / ${format(cap)} today` : `${meta.symbol} • • • • / ${meta.symbol} • • • •`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-primary-foreground/20 overflow-hidden">
              <div className="h-full bg-primary-foreground/80 transition-all" style={{ width: `${showBalance ? capPct : 0}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-6">
            <HeroLink to="/requests" icon={ListChecks} label="History" />
            <HeroLink to="/earnings" icon={Banknote} label="Earnings" />
            <HeroLink to="/profile" icon={Headphones} label="Support" />
          </div>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <MiniStat icon={Wallet} label="Locked" value={format(profile.locked_balance)} />
          <MiniStat icon={TrendingUp} label="Total earned" value={format(profile.total_earnings)} />
          <MiniStat icon={Users} label="Referral code" value={profile.referral_code} mono className="col-span-2 sm:col-span-1" />
        </div>

        {/* Quick Actions */}
        <div className="text-xs uppercase tracking-widest text-primary mb-3 mt-8">Quick Actions</div>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Button asChild variant="outline" size="lg" className="h-20 flex-col gap-2 hover:border-primary/50">
            <Link to="/upgrade">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              <span>Upgrade</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-20 flex-col gap-2 hover:border-primary/50">
            <Link to="/withdraw">
              <Banknote className="h-5 w-5 text-primary" />
              <span>Withdraw</span>
            </Link>
          </Button>
        </div>

        {/* Ways to earn */}
        <div className="text-xs uppercase tracking-widest text-primary mb-3">Ways to earn</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {tiles.map((t) => {
            const locked = profile.level < t.unlock;
            return (
              <Link
                key={t.id}
                to={locked ? "/upgrade?locked=1" : "/activities"}
                className={`glass-card rounded-xl p-4 text-center relative hover:border-primary/40 transition-colors ${locked ? "upgrade-watermark" : ""}`}
              >
                {locked && (
                  <span className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full border border-border bg-secondary/70 text-muted-foreground grid place-items-center">
                    <Lock className="h-3 w-3" />
                  </span>
                )}
                <Icon3D name={t.icon} size={32} className={`mx-auto ${locked ? "opacity-50 grayscale" : ""}`} />
                <div className="text-[11px] font-medium mt-2 leading-tight">{t.title}</div>
              </Link>
            );
          })}
        </div>

        {/* Refer & Earn banner */}
        <Link to="/referrals" className="block group">
          <Card className="rounded-xl p-5 ring-1 ring-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/30 grid place-items-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg font-semibold">Refer & Earn</div>
              <div className="text-sm text-muted-foreground">Invite friends and earn bonuses when they upgrade.</div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Card>
        </Link>
      </div>
      <BottomNav />
    </div>
  );
};

const HeroLink = ({ to, icon: Icon, label }: any) => (
  <Link to={to} className="flex flex-col items-center gap-1 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors text-primary-foreground text-xs font-medium">
    <Icon className="h-4 w-4" />
    {label}
  </Link>
);

const MiniStat = ({ icon: Icon, label, value, mono, className = "" }: any) => (
  <Card className={`glass-card p-4 rounded-xl ${className}`}>
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5"><Icon className="h-3.5 w-3.5" />{label}</div>
    <div className={`font-semibold tabular-nums truncate ${mono ? "font-mono text-base tracking-widest" : "text-lg"}`}>{value}</div>
  </Card>
);

export default Dashboard;
