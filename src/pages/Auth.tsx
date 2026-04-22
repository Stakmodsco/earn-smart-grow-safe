import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  full_name: z.string().trim().min(1).max(100),
  referral_code: z.string().trim().max(20).optional().or(z.literal("")),
});

const Auth = () => {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", referral_code: params.get("ref") ?? "" });
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: form.full_name, referral_code: form.referral_code || null },
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome to Monetra");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
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
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Full name">
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" required />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
            </Field>
            <Field label="Password">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required minLength={8} />
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
              <>Already have an account? <button className="text-primary hover:underline" onClick={() => setMode("signin")}>Sign in</button></>
            ) : (
              <>New to Monetra? <button className="text-primary hover:underline" onClick={() => setMode("signup")}>Create one</button></>
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
