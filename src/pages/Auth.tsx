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
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { checkPassword, generateStrongPassword, passwordError, validateEmail, EMAIL_HINT } from "@/lib/passwordRules";

type Captcha = { id: string; a: number; b: number };

async function fetchCaptcha(): Promise<Captcha> {
  const { data, error } = await supabase.functions.invoke("captcha-challenge", { method: "POST" });
  if (error) throw error;
  return data as Captcha;
}

const Auth = () => {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", referral_code: params.get("ref") ?? "" });
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  // After a successful signup we want to switch the form into "signin" mode
  // and surface a clear "check your email" notice. We track that locally.
  const [postSignupEmail, setPostSignupEmail] = useState<string | null>(null);
  const [recoveryKeys, setRecoveryKeys] = useState<string[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { format } = useCurrency();

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const refreshCaptcha = async () => {
    setCaptchaLoading(true);
    setCaptchaInput("");
    try {
      setCaptcha(await fetchCaptcha());
    } catch {
      toast.error("Could not load captcha. Please try again.");
      setCaptcha(null);
    } finally {
      setCaptchaLoading(false);
    }
  };

  // Load a captcha when entering signup mode.
  useEffect(() => {
    if (mode === "signup" && !captcha) refreshCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const passwordChecks = checkPassword(form.password);
  const suggestStrongPassword = () => {
    const password = generateStrongPassword();
    setForm((f) => ({ ...f, password }));
    toast.success("Strong password suggested. Save it somewhere safe.");
  };

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
        if (!captcha) { toast.error("Captcha not loaded. Please refresh."); setLoading(false); return; }
        const answerNum = Number(captchaInput);
        if (!Number.isFinite(answerNum)) {
          toast.error("Enter the captcha answer."); setLoading(false); return;
        }

        const { data, error } = await supabase.functions.invoke("signup", {
          body: {
            email: form.email.trim().toLowerCase(),
            password: form.password,
            full_name: form.full_name.trim(),
            referral_code: form.referral_code || null,
            captcha_id: captcha.id,
            captcha_answer: answerNum,
          },
        });
        if (error || (data as any)?.error) {
          const msg = (data as any)?.error ?? error?.message ?? "Could not create account";
          toast.error(msg);
          await refreshCaptcha();
          setLoading(false);
          return;
        }
        // ADD RECOVERY KEY CODE HERE
        const newRecoveryKeys = (data as any)?.recoveryKeys;
        
        if (newRecoveryKeys?.length) {
          setRecoveryKeys(newRecoveryKeys);
          localStorage.setItem("generatedRecoveryKeys", JSON.stringify(newRecoveryKeys));
        }
        
        setPostSignupEmail(form.email.trim().toLowerCase());
        setMode("signin");
        setForm((f) => ({ ...f, password: "" }));
        setCaptcha(null);
        setCaptchaInput("");
        toast.success("Account created — please sign in to continue.");
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
              {mode === "signup" ? `Get a ${format(20)} welcome bonus added to your balance instantly.` : "Sign in to your Cheddar4u dashboard."}
            </p>
          </div>

          {/* Post-signup confirmation notice */}
          {mode === "signin" && postSignupEmail && (
      {mode === "signin" && recoveryKeys.length > 0 && (
  <div className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
    <div className="font-semibold text-red-500">
      Save your recovery keys
    </div>

    <p className="mt-2 text-muted-foreground">
      These keys are shown only once. If you lose them, your account cannot be recovered.
    </p>

    <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs">
      {recoveryKeys.map((key) => (
        <div key={key} className="rounded border bg-background p-2">
          {key}
        </div>
      ))}
    </div>
  </div>
)}
            <div className="mb-5 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm flex gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Account created 🎉</div>
                <div className="text-muted-foreground mt-1">
                  Sign in below with <span className="font-medium text-foreground">{postSignupEmail}</span> to access your dashboard.
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
              {mode === "signup" && (
                <div className="mb-2 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={suggestStrongPassword}>
                    Suggest strong password
                  </Button>
                </div>
              )}
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
            {mode === "signup" && (
              <Field label={captcha ? `Captcha — what is ${captcha.a} + ${captcha.b}?` : "Captcha"}>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder={captcha ? "Type the answer" : "Loading…"}
                    required
                    disabled={!captcha || captchaLoading}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={refreshCaptcha} disabled={captchaLoading}>
                    {captchaLoading ? "…" : "New"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Quick check to confirm you're human — verified server-side.</p>
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
              <>New to Cheddar4u? <button className="text-primary hover:underline" onClick={() => { setMode("signup"); setPostSignupEmail(null); }}>Create one</button></>
            )}
          </div>
          {mode === "signin" && (
            <div className="mt-3 text-center">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot your password?</Link>
            </div>
          )}
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
