import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { BackButton } from "@/components/BackButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, Download, Eye, EyeOff, RefreshCw } from "lucide-react";

const AccountSecurity = () => {
  const { user, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);
  const [reveal, setReveal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const regenerate = async () => {
    if (!currentPassword) return toast.error("Enter your current password");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("regenerate-recovery-keys", {
      body: { currentPassword },
    });
    setBusy(false);
    const errMsg = (data as any)?.error ?? error?.message;
    if (errMsg) return toast.error(errMsg);

    const newKeys = (data as any)?.recoveryKeys as string[];
    if (!newKeys?.length) return toast.error("Could not generate keys");
    setKeys(newKeys);
    setReveal(true);
    setCurrentPassword("");
    setConfirmOpen(false);
    toast.success("New recovery keys generated — save them now");
  };

  const download = () => {
    const content = [
      "Cheddar4u Recovery Keys",
      "",
      "Save these keys somewhere safe.",
      "If you lose them, your account cannot be recovered.",
      "",
      ...keys.map((k, i) => `Key ${i + 1}: ${k}`),
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cheddar4u-recovery-keys.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-2xl py-10">
        <BackButton />
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Security</div>
        <h1 className="font-display text-4xl font-semibold mb-2">Account security</h1>
        <p className="text-muted-foreground mb-8">Manage your recovery keys used to reset your password.</p>

        <Card className="glass-card p-6 rounded-xl">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-xl font-semibold">Recovery keys</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Generate a new set of 10 one-time recovery keys. Your old keys will stop working immediately.
              </p>
            </div>
          </div>

          {keys.length > 0 ? (
            <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-5">
              <div className="flex items-center gap-2 text-red-500 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Save these now
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                These are shown only once. If you lose them, your account cannot be recovered.
              </p>
              <div className="mt-4 grid gap-2 font-mono text-xs">
                {keys.map((k, i) => (
                  <div key={k} className="flex items-center justify-between rounded border bg-background p-2">
                    <span>Key {i + 1}</span>
                    <span>{reveal ? k : "************"}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setReveal((v) => !v)}>
                  {reveal ? <><EyeOff className="h-4 w-4 mr-2" />Hide</> : <><Eye className="h-4 w-4 mr-2" />Reveal</>}
                </Button>
                <Button type="button" variant="hero" onClick={download}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
              <Button variant="ghost" className="w-full mt-3" onClick={() => setKeys([])}>I've saved them</Button>
            </div>
          ) : confirmOpen ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <strong>Heads up:</strong> Regenerating will permanently invalidate your old recovery keys.
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Current password</Label>
                <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setConfirmOpen(false); setCurrentPassword(""); }}>Cancel</Button>
                <Button variant="hero" className="flex-1" disabled={busy} onClick={regenerate}>
                  {busy ? "Generating…" : "Regenerate keys"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="hero" className="mt-5 w-full" onClick={() => setConfirmOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-2" /> Regenerate recovery keys
            </Button>
          )}
        </Card>

        <div className="mt-6 text-center text-sm">
          <Link to="/profile" className="text-primary hover:underline">← Back to profile</Link>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default AccountSecurity;
