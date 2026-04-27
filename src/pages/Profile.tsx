import { Navigate, useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { BackButton } from "@/components/BackButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth, useProfile, useIsAdmin } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Lock, ShieldCheck, User as UserIcon } from "lucide-react";

const Profile = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const isAdmin = useIsAdmin(user?.id);
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center text-muted-foreground">Loading…</div><BottomNav /></div>;

  const initials = (profile.full_name || profile.email || "U")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const onResetPassword = async () => {
    if (!profile.email) return toast.error("No email on file");
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent to your email");
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-3xl py-10">
        <BackButton />
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Profile</div>
        <h1 className="font-display text-4xl font-semibold mb-8">Your account</h1>

        <Card className="glass-card p-8 rounded-xl text-center">
          <div className="h-20 w-20 mx-auto rounded-full bg-gradient-emerald grid place-items-center text-primary-foreground font-display text-2xl font-semibold shadow-emerald">
            {initials}
          </div>
          <div className="font-display text-2xl font-semibold mt-4">{profile.full_name || "Member"}</div>
          <div className="text-sm text-muted-foreground">{profile.email}</div>

          <div className="grid grid-cols-2 gap-6 mt-8 text-left">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Level</div>
              <div className="font-display text-3xl font-semibold mt-1">{profile.level}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Balance</div>
              <div className="font-display text-3xl font-semibold mt-1 tabular-nums">${Number(profile.balance).toFixed(2)}</div>
            </div>
          </div>
        </Card>

        <Card className="glass-card p-6 rounded-xl mt-6">
          <h3 className="font-display text-xl font-semibold mb-4">Account info</h3>
          <Row label="Status" value={<span className={profile.flagged ? "text-destructive" : "text-primary"}>{profile.flagged ? "Flagged" : "Active"}</span>} />
          <Row label="Total earnings" value={<span className="tabular-nums">${Number(profile.total_earnings).toFixed(2)}</span>} />
          <Row label="Locked balance" value={<span className="tabular-nums">${Number(profile.locked_balance).toFixed(2)}</span>} />
          <Row label="Referral code" value={<code className="font-mono text-xs">{profile.referral_code}</code>} />
          <Row label="Joined" value={new Date((profile as any).created_at ?? Date.now()).toLocaleDateString()} last />
        </Card>

        <Card className="glass-card p-6 rounded-xl mt-6">
          <h3 className="font-display text-xl font-semibold mb-4">Security</h3>
          <Button variant="outline" className="w-full justify-start" onClick={onResetPassword}>
            <Lock className="h-4 w-4 mr-2" /> Send password reset email
          </Button>
        </Card>

        <Card className="glass-card p-6 rounded-xl mt-6">
          <h3 className="font-display text-xl font-semibold mb-4">Quick links</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Button asChild variant="outline" className="justify-start h-11"><Link to="/requests">📋 My requests</Link></Button>
            <Button asChild variant="outline" className="justify-start h-11"><Link to="/receipts">🧾 Task receipts</Link></Button>
            <Button asChild variant="outline" className="justify-start h-11"><Link to="/referrals">👥 Referrals</Link></Button>
            <Button asChild variant="outline" className="justify-start h-11"><Link to="/checkin-history">📅 Check-in history</Link></Button>
            {isAdmin && (
              <Button asChild variant="outline" className="justify-start h-11 sm:col-span-2"><Link to="/admin"><ShieldCheck className="h-4 w-4 mr-2" /> Admin console</Link></Button>
            )}
          </div>
        </Card>

        <Button variant="destructive" className="w-full mt-6 h-12" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Log out
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

const Row = ({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) => (
  <div className={`flex items-center justify-between py-3 ${last ? "" : "border-b border-border"}`}>
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

export default Profile;
