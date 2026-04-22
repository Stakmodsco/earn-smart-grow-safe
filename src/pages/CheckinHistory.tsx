import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, CheckCircle2, Circle } from "lucide-react";

type Row = { reward: number; completed_at: string };

const CheckinHistory = () => {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    const since = new Date(); since.setDate(since.getDate() - 30);
    supabase.from("tasks_log").select("reward, completed_at")
      .eq("user_id", user.id).eq("task_type", "checkin")
      .gte("completed_at", since.toISOString())
      .order("completed_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  // Build last 30 days
  const days: { date: Date; key: string; claimed: boolean; reward: number }[] = [];
  const claimedMap = new Map<string, number>();
  rows.forEach((r) => {
    const k = new Date(r.completed_at).toISOString().slice(0, 10);
    claimedMap.set(k, Number(r.reward));
  });
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: d, key, claimed: claimedMap.has(key), reward: claimedMap.get(key) ?? 0 });
  }

  const claimedCount = days.filter(d => d.claimed).length;
  const totalEarned = days.reduce((s, d) => s + d.reward, 0);

  // Streak: consecutive days starting today going back
  let streak = 0;
  for (const d of days) { if (d.claimed) streak++; else break; }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container py-10 max-w-4xl">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Check-in history</div>
        <h1 className="font-display text-4xl font-semibold mb-8">Last 30 days</h1>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Stat label="Days claimed" value={`${claimedCount} / 30`} />
          <Stat label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} accent />
          <Stat label="Earned from check-ins" value={`$${totalEarned.toFixed(2)}`} />
        </div>

        <Card className="glass-card p-6 rounded-xl mb-6">
          <h3 className="font-display text-xl font-semibold mb-4">Daily grid</h3>
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
            {days.slice().reverse().map((d) => (
              <div
                key={d.key}
                title={`${d.date.toLocaleDateString()} — ${d.claimed ? `claimed $${d.reward.toFixed(2)}` : "missed"}`}
                className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-xs ${
                  d.claimed
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-secondary/30 text-muted-foreground"
                }`}
              >
                <span className="font-medium">{d.date.getDate()}</span>
                {d.claimed ? <CheckCircle2 className="h-3 w-3 mt-0.5" /> : <Circle className="h-3 w-3 mt-0.5 opacity-40" />}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/20 border border-primary/40" /> Claimed</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-secondary/40 border border-border" /> Missed</span>
          </div>
        </Card>

        <Card className="glass-card p-6 rounded-xl">
          <h3 className="font-display text-xl font-semibold mb-4">Detailed log</h3>
          <div className="divide-y divide-border">
            {days.map((d) => (
              <div key={d.key} className="py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{d.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                </div>
                {d.claimed ? (
                  <span className="text-primary tabular-nums">+ ${d.reward.toFixed(2)}</span>
                ) : (
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Missed</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div className="mt-6"><Button asChild variant="outline"><Link to="/dashboard">← Dashboard</Link></Button></div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, accent }: any) => (
  <Card className={`glass-card p-5 rounded-xl ${accent ? "ring-1 ring-primary/30" : ""}`}>
    <div className="text-xs text-muted-foreground mb-2">{label}</div>
    <div className="font-display text-2xl font-semibold tabular-nums">{value}</div>
  </Card>
);

export default CheckinHistory;
