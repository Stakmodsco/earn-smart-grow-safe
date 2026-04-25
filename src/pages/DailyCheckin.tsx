import { useEffect, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { GlossyTile } from "@/components/GlossyTile";

const DailyCheckin = () => {
  const { user, loading } = useAuth();
  const { profile, refresh } = useProfile(user?.id);
  const [reward, setReward] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    supabase.from("app_settings").select("value").eq("key", "checkin_rewards").maybeSingle()
      .then(({ data }) => {
        const m = (data?.value as Record<string, number> | null) ?? {};
        setReward(Number(m[String(profile.level ?? 0)] ?? 0));
      });
  }, [profile?.level]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile) {
    return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center text-muted-foreground">Loading…</div><BottomNav /></div>;
  }

  const canCheckin = !profile.last_checkin || (Date.now() - new Date(profile.last_checkin).getTime() >= 24 * 60 * 60 * 1000);
  const nextInMs = profile.last_checkin ? Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - new Date(profile.last_checkin).getTime())) : 0;
  const hours = Math.floor(nextInMs / 3_600_000);
  const minutes = Math.floor((nextInMs % 3_600_000) / 60_000);

  const handleCheckin = async () => {
    if (!canCheckin || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("checkin");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Daily check-in done! +$${Number(data.reward ?? 0).toFixed(3)} added to your balance 🎉`);
      await refresh();
      // Brief delay so the toast is visible, then redirect to dashboard
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (e: any) {
      toast.error(e.message ?? "Check-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      {/* Hero header — gradient banner like the reference */}
      <div className="bg-gradient-to-r from-primary via-primary to-accent text-primary-foreground">
        <div className="container py-10 max-w-3xl text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold">Daily Check-in</h1>
        </div>
      </div>

      <div className="container max-w-3xl py-10 -mt-6">
        {/* Reward card */}
        <Card className="glass-card rounded-2xl p-8 text-center shadow-xl">
          <h2 className="font-display text-2xl font-semibold mb-3">Daily Check-in Reward</h2>
          <div className="font-display text-5xl font-semibold text-primary tabular-nums mb-3">
            ${reward.toFixed(3)}
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Check in once every 24 hours to receive your daily reward.<br />
            Keep checking in daily to build your earning habit.
          </p>

          {canCheckin ? (
            <Button
              variant="hero"
              size="lg"
              className="w-full sm:w-2/3 mx-auto"
              onClick={handleCheckin}
              disabled={busy}
            >
              <Sparkles className="h-4 w-4" />
              {busy ? "Crediting…" : "Check-in Now"}
            </Button>
          ) : (
            <Button variant="outline" size="lg" className="w-full sm:w-2/3 mx-auto" disabled>
              <Clock className="h-4 w-4" />
              Available in {hours}h {minutes}m
            </Button>
          )}
        </Card>

        {/* Explainer */}
        <Card className="glass-card rounded-2xl p-8 mt-6">
          <div className="flex items-center gap-3 mb-4">
            <GlossyTile icon={Calendar} variant="primary" size="md" />
            <h3 className="font-display text-xl font-semibold">How Daily Check-in Works</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Daily check-in lets you earn small rewards simply by visiting Monetra each day.
            Build a consistent habit and watch your balance grow.
          </p>
          <ul className="space-y-2 text-sm">
            {[
              "You can check in once every 24 hours.",
              "Each successful check-in adds a reward to your balance.",
              "Rewards accumulate over time — they don't reset.",
              "Make sure you return daily so you don't miss your reward.",
              "Check-ins help you stay engaged and grow your earnings.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-6 flex gap-2 justify-center">
          <Button asChild variant="outline"><Link to="/checkin-history">View history</Link></Button>
          <Button asChild variant="ghost"><Link to="/activities">← Activities</Link></Button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default DailyCheckin;
