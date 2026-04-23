import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownLeft, ArrowUpRight, Clock, FileText } from "lucide-react";

const Requests = () => {
  const { user, loading } = useAuth();
  const [upgrades, setUpgrades] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).eq("type", "upgrade").order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("requested_at", { ascending: false }),
    ]).then(([u, w]) => {
      setUpgrades(u.data ?? []);
      setWithdrawals(w.data ?? []);
    });
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container py-10 max-w-4xl">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">My requests</div>
        <h1 className="font-display text-4xl font-semibold mb-8">Upgrade & withdrawal status</h1>

        <Tabs defaultValue="all">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="upgrades">Upgrades ({upgrades.length})</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals ({withdrawals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <RequestList items={[...upgrades.map(u => ({ ...u, _kind: "upgrade" })), ...withdrawals.map(w => ({ ...w, _kind: "withdrawal", created_at: w.requested_at }))]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())} />
          </TabsContent>
          <TabsContent value="upgrades"><RequestList items={upgrades.map(u => ({ ...u, _kind: "upgrade" }))} /></TabsContent>
          <TabsContent value="withdrawals"><RequestList items={withdrawals.map(w => ({ ...w, _kind: "withdrawal", created_at: w.requested_at }))} /></TabsContent>
        </Tabs>

        <div className="mt-8"><Button asChild variant="outline"><Link to="/dashboard">← Dashboard</Link></Button></div>
      </div>
      <BottomNav />
    </div>
  );
};

const RequestList = ({ items }: { items: any[] }) => {
  if (items.length === 0) {
    return <Card className="glass-card p-10 rounded-xl text-center text-muted-foreground text-sm">No requests yet.</Card>;
  }
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <Card key={`${it._kind}-${it.id}`} className="glass-card p-5 rounded-xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${
                it._kind === "upgrade" ? "bg-primary/10 border border-primary/20" : "bg-warning/10 border border-warning/20"
              }`}>
                {it._kind === "upgrade" ? <ArrowUpRight className="h-4 w-4 text-primary" /> : <ArrowDownLeft className="h-4 w-4 text-warning" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {it._kind === "upgrade" ? `Upgrade to Level ${it.target_level}` : `Withdrawal — ${it.payout_method?.replace("_", " ")}`}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums mt-0.5">
                  ${Number(it.amount).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Submitted {new Date(it.created_at).toLocaleString()}</span>
                  {(it.reviewed_at || it.processed_at) && (
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Reviewed {new Date(it.reviewed_at || it.processed_at).toLocaleString()}</span>
                  )}
                </div>
                {it.notes && (
                  <div className="mt-3 rounded-lg bg-secondary/40 border border-border p-3 text-xs text-muted-foreground flex gap-2">
                    <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span><span className="text-foreground/80">Notes: </span>{it.notes}</span>
                  </div>
                )}
                {it._kind === "withdrawal" && (
                  <div className="mt-2 text-xs text-muted-foreground"><span className="text-foreground/80">Payout: </span>{it.payout_details}</div>
                )}
              </div>
            </div>
            <StatusBadge status={it.status} />
          </div>
        </Card>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: "bg-warning/15 text-warning border-warning/30", label: "Pending review" },
    approved: { cls: "bg-primary/15 text-primary border-primary/30", label: "Approved" },
    completed: { cls: "bg-primary/15 text-primary border-primary/30", label: "Completed" },
    rejected: { cls: "bg-destructive/15 text-destructive border-destructive/30", label: "Rejected" },
  };
  const m = map[status] ?? { cls: "bg-secondary", label: status };
  return <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border ${m.cls} shrink-0`}>{m.label}</span>;
};

export default Requests;
