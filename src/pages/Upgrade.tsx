import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";

const Upgrade = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const [settings, setSettings] = useState<any>(null);
  const [target, setTarget] = useState<number>(1);
  const [method, setMethod] = useState("bank");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("app_settings").select("*").then(({ data }) => {
      const m: any = {}; data?.forEach((r: any) => (m[r.key] = r.value)); setSettings(m);
    });
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile || !settings) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center">Loading…</div></div>;

  const prices = settings.level_prices as Record<string, number>;
  const instructions = settings.payment_instructions as Record<string, string>;

  const submit = async () => {
    if (!file) return toast.error("Please upload your payment proof");
    if (target <= profile.level) return toast.error("Choose a higher level");
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("proofs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data, error } = await supabase.functions.invoke("submit-upgrade", {
        body: { target_level: target, payment_method: method, proof_url: path, notes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Upgrade submitted — admin will review within 24h");
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-3xl py-10">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Membership</div>
        <h1 className="font-display text-4xl font-semibold mb-2">Upgrade your tier</h1>
        <p className="text-muted-foreground mb-8">You're currently Level {profile.level}. Higher tiers unlock larger daily caps and faster withdrawals.</p>

        <div className="grid md:grid-cols-3 gap-3 mb-8">
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              disabled={lvl <= profile.level}
              onClick={() => setTarget(lvl)}
              className={`text-left rounded-xl border p-5 transition-all ${
                target === lvl ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border hover:border-primary/40"
              } ${lvl <= profile.level ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <div className="flex justify-between items-baseline">
                <span className="font-display text-xl font-semibold">Level {lvl}</span>
                {target === lvl && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <div className="font-display text-2xl mt-2">${prices[String(lvl)]}</div>
            </button>
          ))}
        </div>

        <Card className="glass-card p-6 rounded-xl mb-6">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payment method</Label>
          <RadioGroup value={method} onValueChange={setMethod} className="grid sm:grid-cols-3 gap-3 mt-3">
            {[
              { id: "bank", label: "Bank transfer" },
              { id: "crypto", label: "Crypto (USDT)" },
              { id: "mobile_money", label: "Mobile money" },
            ].map((m) => (
              <label key={m.id} className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${method === m.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value={m.id} id={m.id} />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
          </RadioGroup>

          <div className="mt-5 rounded-lg bg-secondary/40 border border-border p-4 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
            {instructions[method]}
          </div>
        </Card>

        <Card className="glass-card p-6 rounded-xl mb-6">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Upload payment proof</Label>
          <div className="mt-3 border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-3" />
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-sm mx-auto" />
            {file && <div className="text-sm text-muted-foreground mt-3">{file.name}</div>}
          </div>

          <Label className="text-xs uppercase tracking-wide text-muted-foreground mt-6 block">Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transaction reference, sender name, etc." maxLength={500} className="mt-2" />
        </Card>

        <Button variant="hero" size="lg" className="w-full" onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : `Submit upgrade to Level ${target} ($${prices[String(target)]})`}
        </Button>
      </div>
    </div>
  );
};

export default Upgrade;
