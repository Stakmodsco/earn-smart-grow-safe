import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Circle, KeyRound } from "lucide-react";
import { checkPassword, passwordError } from "@/lib/passwordRules";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = checkPassword(password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Enter your email");
    if (!recoveryKey.trim()) return toast.error("Enter a recovery key");
    const pwErr = passwordError(password);
    if (pwErr) return toast.error(pwErr);
    if (password !== confirm) return toast.error("Passwords do not match");

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("recovery-reset", {
      body: {
        email: email.trim().toLowerCase(),
        recoveryKey: recoveryKey.trim(),
        password,
      },
    });
    setLoading(false);

    const errMsg = (data as any)?.error ?? error?.message;
    if (errMsg) return toast.error(errMsg);

    toast.success("Password reset — please sign in with your new password");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-md py-16">
        <Card className="glass-card p-8 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl sm:text-3xl font-semibold">Reset with recovery key</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your email and one of the recovery keys you saved when signing up. Each key works only once.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Recovery key</Label>
              <Input value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())} placeholder="XXXXXXXXXXXX" maxLength={20} required className="font-mono tracking-wider" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">New password</Label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" />
              {password.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px]">
                  {checks.map((c) => (
                    <li key={c.id} className={`flex items-center gap-1.5 ${c.ok ? "text-primary" : "text-muted-foreground"}`}>
                      {c.ok ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Confirm new password</Label>
              <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Resetting…" : "Reset password"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link to="/auth" className="text-primary hover:underline">← Back to sign in</Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
