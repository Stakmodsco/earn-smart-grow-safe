import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { checkPassword, passwordError, validateEmail, EMAIL_HINT } from "@/lib/passwordRules";

const Auth = () => {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", referral_code: params.get("ref") ?? "" });
  // After a successful signup we want to switch the form into "signin" mode
  // and surface a clear "check your email" notice. We track that locally.
  const [postSignupEmail, setPostSignupEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const passwordChecks = checkPassword(form.password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const emailIssue = validateEmail(form.email);
        if (emailIssue) {
          const msg =
            emailIssue === "format" ? "Enter a valid email address." :
            emailIssue === "long" ? "That email is too long." :
            "Disposable email addresses are not allowed.";
          toast.error(msg); setLoading(false); return;
        }
        const pwErr = passwordError(form.password);
        if (pwErr) { toast.error(pwErr); setLoading(false); return; }
        if (!form.full_name.trim()) { toast.error("Enter your full name"); setLoading(false); return; }

        const { error } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: form.full_name.trim(), referral_code: form.referral_code || null },
          },
        });
        if (error) throw error;
        // Show "check your email" state and flip to sign-in mode.
        setPostSignupEmail(form.email.trim().toLowerCase());
        setMode("signin");
        setForm((f) => ({ ...f, password: "" }));
        toast.success("Account created — check your email to confirm, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-md py-16">
        <Card className="glass-card p-8 rounded-xl">
          <div className="mb-6">
            <h1 className="font-display text-3xl font-semibold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "signup" ? "Free Level 0 to start. Upgrade anytime." : "Sign in to your Monetra dashboard."}
            </p>
          </div>

          {/* Post-signup confirmation notice */}
          {mode === "signin" && postSignupEmail && (
            <div className="mb-5 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm flex gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Confirm your email</div>
                <div className="text-muted-foreground mt-1">
                  We sent a confirmation link to <span className="font-medium text-foreground">{postSignupEmail}</span>.
                  Click it, then come back here to sign in.
                </div>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Full name">
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" required maxLength={100} />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required maxLength={254} autoComplete="email" />
              {mode === "signup" && (
                <p className="text-[11px] text-muted-foreground mt-1">{EMAIL_HINT}</p>
              )}
            </Field>
            <Field label="Password">
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                minLength={8}
                maxLength={72}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              {mode === "signup" && form.password.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px]">
                  {passwordChecks.map((c) => (
                    <li key={c.id} className={`flex items-center gap-1.5 ${c.ok ? "text-primary" : "text-muted-foreground"}`}>
                      {c.ok ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
            {mode === "signup" && (
              <Field label="Referral code (optional)">
                <Input value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })} placeholder="ABCD1234" maxLength={20} />
              </Field>
            )}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account? <button className="text-primary hover:underline" onClick={() => { setMode("signin"); setPostSignupEmail(null); }}>Sign in</button></>
            ) : (
              <>New to Monetra? <button className="text-primary hover:underline" onClick={() => { setMode("signup"); setPostSignupEmail(null); }}>Create one</button></>
            )}
          </div>
          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default Auth;
