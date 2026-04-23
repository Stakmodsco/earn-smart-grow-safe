import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Play, Sparkles, Timer } from "lucide-react";

type Row = { id: string; task_type: string; reward: number; completed_at: string };

const Receipts = () => {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | "watch" | "spin">("all");

  useEffect(() => {
    if (!user) return;
    supabase.from("tasks_log").select("*").eq("user_id", user.id)
      .in("task_type", ["watch", "spin"])
      .order("completed_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const filtered = filter === "all" ? rows : rows.filter(r => r.task_type === filter);
  const total = filtered.reduce((s, r) => s + Number(r.reward), 0);

  // group by day
  const groups = filtered.reduce<Record<string, Row[]>>((acc, r) => {
    const d = new Date(r.completed_at).toLocaleDateString();
    (acc[d] = acc[d] ?? []).push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container py-10 max-w-4xl">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Receipts</div>
        <h1 className="font-display text-4xl font-semibold mb-2">Task earnings ledger</h1>
        <p className="text-muted-foreground mb-8">Every Watch & Earn and Spin & Win completion, credited to your balance after server-side validation.</p>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex gap-2">
            {(["all", "watch", "spin"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "soft" : "ghost"} onClick={() => setFilter(f)}>
                {f === "all" ? "All tasks" : f === "watch" ? "Watch & Earn" : "Spin & Win"}
              </Button>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            {filtered.length} entries • <span className="text-primary font-medium">${total.toFixed(2)}</span> credited
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="glass-card p-10 rounded-xl text-center text-muted-foreground text-sm">
            No task receipts yet. Head to the dashboard to start earning.
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([day, items]) => {
              const dayTotal = items.reduce((s, r) => s + Number(r.reward), 0);
              return (
                <div key={day}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{day}</div>
                    <div className="text-xs text-primary tabular-nums">+ ${dayTotal.toFixed(2)}</div>
                  </div>
                  <Card className="glass-card rounded-xl divide-y divide-border">
                    {items.map((r, i) => {
                      const next = items[i + 1];
                      const cooldown = next ? new Date(r.completed_at).getTime() - new Date(next.completed_at).getTime() : null;
                      const Icon = r.task_type === "watch" ? Play : Sparkles;
                      return (
                        <div key={r.id} className="px-5 py-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium capitalize">{r.task_type === "watch" ? "Watch & Earn" : "Spin & Win"}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{new Date(r.completed_at).toLocaleTimeString()}</span>
                                {cooldown !== null && cooldown > 0 && (
                                  <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {formatCooldown(cooldown)} after previous</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="tabular-nums text-primary font-medium">+ ${Number(r.reward).toFixed(2)}</div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Server-validated · #{r.id.slice(0, 6)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8"><Button asChild variant="outline"><Link to="/dashboard">← Dashboard</Link></Button></div>
      </div>
      <BottomNav />
    </div>
  );
};

const formatCooldown = (ms: number) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

export default Receipts;
