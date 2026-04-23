import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Gem, ShieldCheck, ArrowLeft } from "lucide-react";

const TIERS = [
  { level: 1, name: "Silver", features: ["Watch & Earn unlocked", "Spin & Win unlocked", "Standard withdrawal speed", "Daily earning limit: $5", "Community access"] },
  { level: 2, name: "Gold", popular: true, features: ["All Silver features", "Faster withdrawals (within 24h)", "Daily earning limit: $15", "Referral commission boost", "Monthly bonus rewards"] },
  { level: 3, name: "Platinum", features: ["All Gold features", "Priority withdrawal review", "Daily earning limit: $40", "VIP community access", "Exclusive tasks"] },
];

const Upgrade = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    supabase.from("app_settings").select("*").then(({ data }) => {
      const m: any = {}; data?.forEach((r: any) => (m[r.key] = r.value)); setSettings(m);
    });
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile || !settings) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center text-muted-foreground">Loading…</div><BottomNav /></div>;

  const prices = (settings.level_prices ?? {}) as Record<string, number>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-5xl py-10">
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Membership</div>
        <h1 className="font-display text-4xl font-semibold mb-2">Upgrade your tier</h1>
        <p className="text-muted-foreground mb-8">Unlock larger daily caps, more tasks, and faster withdrawals.</p>

        <Card className="glass-card p-6 rounded-xl mb-8 flex items-center gap-5">
          <div className="h-14 w-14 rounded-xl bg-gradient-emerald grid place-items-center shadow-emerald">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Current account level</div>
            <div className="font-display text-2xl font-semibold">Level {profile.level}</div>
          </div>
          <ul className="hidden md:block text-sm text-muted-foreground space-y-1">
            <li>✓ Higher earning limits</li>
            <li>✓ Priority support & rewards</li>
          </ul>
        </Card>

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t) => {
            const owned = profile.level >= t.level;
            const usd = prices[String(t.level)] ?? 0;
            return (
              <Card
                key={t.level}
                className={`glass-card rounded-xl p-6 relative flex flex-col ${t.popular ? "ring-2 ring-primary" : ""}`}
              >
                {t.popular && (
                  <span className="absolute -top-3 right-5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary text-primary-foreground font-medium">
                    Most popular
                  </span>
                )}
                <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center mb-4">
                  <Gem className="h-6 w-6 text-primary" />
                </div>
                <div className="font-display text-xl font-semibold">{t.name}</div>
                <div className="font-display text-4xl font-semibold mt-2">${usd.toFixed(2)}</div>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2"><span className="text-primary">✓</span>{f}</li>
                  ))}
                </ul>
                {owned ? (
                  <Button disabled variant="outline" className="w-full mt-6">Current tier</Button>
                ) : (
                  <Button asChild variant="hero" className="w-full mt-6">
                    <Link to={`/payment/${t.level}`}>Upgrade</Link>
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Upgrade;
