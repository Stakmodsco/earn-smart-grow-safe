import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Sparkles } from "lucide-react";

const BecomeAdmin = () => {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin")
      .then(({ count }) => setAdminCount(count ?? 0));
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  const claimFirst = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("bootstrap_first_admin");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data === true) {
      toast.success("You are now the platform admin");
      window.location.href = "/admin";
    } else {
      toast.error("An admin already exists — use an invite code instead");
      setAdminCount(1);
    }
  };

  const claimWithCode = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_admin_with_code", { _code: code.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data === true) {
      toast.success("Admin access granted");
      window.location.href = "/admin";
    } else {
      toast.error("Invalid invite code");
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-xl py-12">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Admin access</div>
        <h1 className="font-display text-4xl font-semibold mb-2">Become an admin</h1>
        <p className="text-muted-foreground mb-8">Admins review upgrades, process withdrawals, and tune platform settings.</p>

        {adminCount === 0 && (
          <Card className="glass-card p-6 rounded-xl mb-4 ring-1 ring-primary/30">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center"><Sparkles className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-display text-xl font-semibold">No admin exists yet</h3>
                <p className="text-sm text-muted-foreground mt-1">As the first registered user, you can claim the founding admin role.</p>
              </div>
            </div>
            <Button variant="hero" className="w-full" onClick={claimFirst} disabled={busy}>
              {busy ? "Claiming…" : "Claim founding admin role"}
            </Button>
          </Card>
        )}

        <Card className="glass-card p-6 rounded-xl">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center"><ShieldCheck className="h-5 w-5 text-primary" /></div>
            <div>
              <h3 className="font-display text-xl font-semibold">Admin invite code</h3>
              <p className="text-sm text-muted-foreground mt-1">An existing admin can share a single-use code from the admin console.</p>
            </div>
          </div>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXXXXXX" maxLength={20} className="font-mono tracking-widest mb-3" />
          <Button variant="outline" className="w-full" onClick={claimWithCode} disabled={busy || !code.trim()}>Redeem code</Button>
        </Card>

        <div className="mt-6"><Button asChild variant="ghost"><Link to="/dashboard">← Back to dashboard</Link></Button></div>
      </div>
    </div>
  );
};

export default BecomeAdmin;
