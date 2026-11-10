import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { Copy, Link as LinkIcon, Users, Zap, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { getMiningSpeedMultiplier } from "@/lib/mining";

type ReferralRow = {
  id: string;
  created_at: string;
  child?: { email?: string | null; full_name?: string | null } | null;
};

const Referrals = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const [refs, setRefs] = useState<ReferralRow[]>([]);
  const [qualifiedIds, setQualifiedIds] = useState<Set<string>>(new Set());
  const [qualifiedCount, setQualifiedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [referralResult, qualificationResult] = await Promise.all([
        supabase
          .from("referrals")
          .select("id,created_at,child:profiles!referrals_child_user_fkey(email,full_name)")
          .eq("parent_user", user.id)
          .eq("depth", 1)
          .order("created_at", { ascending: false }),
        supabase
          .from("referral_qualifications")
          .select("referred_user_id")
          .eq("referrer_id", user.id),
      ]);
      const qualified = new Set((qualificationResult.data ?? []).map((row) => row.referred_user_id));
      setRefs(referralResult.data ?? []);
      setQualifiedIds(qualified);
      setQualifiedCount(qualified.size);
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center">Loading…</div></div>;

  const multiplier = getMiningSpeedMultiplier(qualifiedCount);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container py-10 max-w-5xl">
        <BackButton />
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Referral network</div>
        <h1 className="font-display text-4xl font-semibold mb-2">Grow your mining speed</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Qualified referrals increase your mining speed multiplier. Referrals do not generate direct coin bonuses or trading capital.
        </p>

        <ShareLinkCard code={profile.referral_code} />

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Stat icon={Users} label="Direct referrals" value={String(refs.length)} />
          <Stat icon={CheckCircle2} label="Qualified referrals" value={String(qualifiedCount)} />
          <Stat icon={Zap} label="Mining speed multiplier" value={multiplier + "×"} accent />
        </div>

        <Card className="glass-card p-6 rounded-xl mb-6">
          <h2 className="font-display text-xl font-semibold mb-2">Mining speed tiers</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Every 10 qualified referrals increase your multiplier by 1×. A referral qualifies only after their $5 Mining Activator has been independently confirmed.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[0, 10, 20, 30, 40].map((minimum) => (
              <div key={minimum} className={`rounded-lg border p-3 ${qualifiedCount >= minimum && qualifiedCount < minimum + 10 ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
                <div className="text-xs text-muted-foreground">{minimum === 0 ? "0–9" : minimum + "–" + (minimum + 9)}</div>
                <div className="font-semibold text-lg">{minimum / 10 + 1}×</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Your current tier: {multiplier}×. Higher tiers continue in the same 10-referral increments.</p>
        </Card>

        <Card className="glass-card p-6 rounded-xl">
          <h2 className="font-display text-xl font-semibold mb-4">Your direct referrals</h2>
          {refs.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">No referrals yet. Share your link to invite people.</div>
          ) : (
            <div className="divide-y divide-border">
              {refs.map((ref) => {
                const qualified = qualifiedIds.has((ref as any).child_user);
                return (
                  <div key={ref.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{ref.child?.full_name || ref.child?.email || "Referred account"}</div>
                      <div className="text-xs text-muted-foreground">Joined {new Date(ref.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className={qualified
                      ? "inline-flex items-center gap-1 text-xs text-primary"
                      : "inline-flex items-center gap-1 text-xs text-muted-foreground"}>
                      {qualified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {qualified ? "Qualified" : "Not yet qualified"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="mt-6">
          <Button asChild variant="outline"><Link to="/dashboard">← Dashboard</Link></Button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

const ShareLinkCard = ({ code }: { code: string }) => {
  const link = `${window.location.origin}/auth?mode=signup&ref=${code}`;
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label + " copied!");
    } catch {
      toast.error("Couldn't copy — copy manually");
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me", text: "Join using my referral link:", url: link });
      } catch { /* user cancelled */ }
    } else {
      await copy(link, "Share link");
    }
  };

  return (
    <Card className="glass-card p-6 rounded-xl mb-6 ring-1 ring-primary/30">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center">
          <LinkIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-display text-lg font-semibold">Your referral link</div>
          <div className="text-xs text-muted-foreground">Share through WhatsApp, Telegram, Facebook, X, Instagram, email or any other channel.</div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 bg-secondary/40 rounded-lg p-2.5 border border-border min-w-0">
          <code className="font-mono text-xs sm:text-sm truncate flex-1">{link}</code>
        </div>
        <Button variant="hero" onClick={() => copy(link, "Referral link")}><Copy className="h-4 w-4" /> Copy link</Button>
        <Button variant="outline" onClick={share}>Share</Button>
      </div>
      <div className="text-xs text-muted-foreground mt-3">
        Referral code: <code className="font-mono text-primary">{code}</code>
        <button onClick={() => copy(code, "Referral code")} className="ml-2 text-primary hover:underline">Copy code</button>
      </div>
    </Card>
  );
};

const Stat = ({ icon: Icon, label, value, accent }: any) => (
  <Card className={`glass-card p-5 rounded-xl ${accent ? "ring-1 ring-primary/30" : ""}`}>
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Icon className="h-3.5 w-3.5" />{label}</div>
    <div className="font-display text-2xl font-semibold tabular-nums">{value}</div>
  </Card>
);

export default Referrals;
