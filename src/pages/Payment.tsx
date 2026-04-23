import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bitcoin, Building2, Copy, Smartphone, Upload, ArrowLeft, Ticket, Send, Wallet } from "lucide-react";
import { COUNTRIES, findMethod, type MethodDef } from "@/lib/paymentMethods";

type StructuredInstr = {
  amount_label?: string;
  provider?: string;
  account_name?: string;
  account_number?: string;
  network?: string;
  address?: string;
  notes?: string;
};

type Instructions = string | StructuredInstr;

const ICONS = { Building2, Bitcoin, Smartphone, Ticket, Send, Wallet } as const;

const Payment = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const { level } = useParams();
  const targetLevel = Number(level);
  const [settings, setSettings] = useState<any>(null);
  const [country, setCountry] = useState<string>("INT");
  const [method, setMethod] = useState<string>("bank");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("app_settings").select("*").then(({ data }) => {
      const m: any = {}; data?.forEach((r: any) => (m[r.key] = r.value)); setSettings(m);
    });
  }, []);

  const activeCountry = useMemo(() => COUNTRIES.find((c) => c.id === country) ?? COUNTRIES[0], [country]);
  const activeMethod = useMemo(() => activeCountry.methods.find((m) => m.id === method) ?? activeCountry.methods[0], [activeCountry, method]);

  // Reset method + fields whenever country changes
  useEffect(() => {
    const first = activeCountry.methods[0]?.id;
    if (first) setMethod(first);
    setFields({});
  }, [country]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (![1, 2, 3].includes(targetLevel)) return <Navigate to="/upgrade" replace />;
  if (!profile || !settings) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center text-muted-foreground">Loading…</div><BottomNav /></div>;

  if (targetLevel <= profile.level) {
    return (
      <div className="min-h-screen"><Navbar />
        <div className="container py-20 text-center max-w-md">
          <p className="text-muted-foreground mb-4">You're already at Level {profile.level}. Choose a higher tier.</p>
          <Button asChild variant="hero"><Link to="/upgrade">Pick a tier</Link></Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const prices = settings.level_prices as Record<string, number>;
  const usd = Number(prices?.[String(targetLevel)] ?? 0);
  const fxRates = (settings.fx_rates ?? { NGN: 1481.47, GHS: 15, ZAR: 18.5 }) as Record<string, number>;
  const localAmounts = Object.entries(fxRates).map(([code, rate]) => ({
    code, value: usd * Number(rate),
  }));

  const planName = ({ 1: "Silver", 2: "Gold", 3: "Platinum" } as any)[targetLevel];
  const instructions = (settings.payment_instructions ?? {}) as Record<string, Instructions>;

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied");
  };

  const submit = async () => {
    // Validate dynamic fields
    if (activeMethod.fields) {
      for (const f of activeMethod.fields) {
        if (f.required && !(fields[f.key] ?? "").trim()) {
          return toast.error(`${f.label} is required`);
        }
      }
    }
    if (!activeMethod.proofOptional && !file) {
      return toast.error("Please upload your payment proof");
    }
    setSubmitting(true);
    try {
      let proofPath = "";
      if (file) {
        const ext = file.name.split(".").pop();
        proofPath = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("proofs").upload(proofPath, file, { upsert: false });
        if (upErr) throw upErr;
      } else {
        // No file but proof is optional (voucher pin acts as proof). Submit a tiny text marker.
        proofPath = `${user.id}/${Date.now()}-pin-only.txt`;
        const blob = new Blob([`Pin-based submission for ${activeMethod.label} at ${new Date().toISOString()}`], { type: "text/plain" });
        const { error: upErr } = await supabase.storage.from("proofs").upload(proofPath, blob, { upsert: false, contentType: "text/plain" });
        if (upErr) throw upErr;
      }

      // Build a structured notes payload so admins can verify pin/voucher details
      const payload = {
        country: activeCountry.id,
        method: activeMethod.id,
        method_label: activeMethod.label,
        details: fields,
        user_notes: notes,
      };
      const notesString = JSON.stringify(payload);

      const { data, error } = await supabase.functions.invoke("submit-upgrade", {
        body: { target_level: targetLevel, payment_method: activeMethod.id, proof_url: proofPath, notes: notesString },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Payment submitted — admin will review shortly");
      navigate("/requests");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const renderLegacyInstructions = (m: string) => {
    const raw = instructions[m];
    if (!raw) return <div className="text-sm text-muted-foreground">No instructions configured. Please contact support.</div>;

    if (typeof raw === "string") {
      return (
        <div className="space-y-3">
          <div className="rounded-lg bg-secondary/40 border border-border p-4 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
            {raw}
          </div>
          <Button variant="outline" size="sm" onClick={() => copy(raw)}><Copy className="h-3.5 w-3.5 mr-2" /> Copy details</Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-primary/10 border border-primary/30 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-primary/80 uppercase tracking-wide">Amount to pay</div>
            <div className="font-display text-xl font-semibold">${usd.toFixed(2)} USD</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => copy(`${usd}`)}><Copy className="h-4 w-4" /></Button>
        </div>

        {raw.provider && <DetailRow label="Provider" value={raw.provider} />}
        {raw.network && <DetailRow label="Network" value={raw.network} />}
        {raw.account_name && <DetailRow label="Account name" value={raw.account_name} onCopy={() => copy(raw.account_name!)} />}
        {raw.account_number && <DetailRow label="Account number" value={raw.account_number} onCopy={() => copy(raw.account_number!)} mono />}
        {raw.address && <DetailRow label="Wallet address" value={raw.address} onCopy={() => copy(raw.address!)} mono />}
        {raw.notes && <div className="text-xs text-muted-foreground">{raw.notes}</div>}
      </div>
    );
  };

  const renderMethodBody = (m: MethodDef) => {
    if (m.useLegacyInstructions) return renderLegacyInstructions(m.id);

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-primary/10 border border-primary/30 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-primary/80 uppercase tracking-wide">Amount to load</div>
            <div className="font-display text-xl font-semibold">${usd.toFixed(2)} USD</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => copy(`${usd}`)}><Copy className="h-4 w-4" /></Button>
        </div>

        {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}

        <div className="grid gap-3">
          {m.fields?.map((f) => (
            <div key={f.key}>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {f.label} {f.required && <span className="text-destructive">*</span>}
              </Label>
              {f.type === "select" ? (
                <Select
                  value={fields[f.key] ?? ""}
                  onValueChange={(v) => setFields((prev) => ({ ...prev, [f.key]: v }))}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {f.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea
                  className="mt-1.5"
                  placeholder={f.placeholder}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              ) : (
                <Input
                  className="mt-1.5"
                  placeholder={f.placeholder}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  maxLength={120}
                />
              )}
            </div>
          ))}
        </div>

        {m.proofOptional && (
          <div className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded-lg p-3">
            🛈 The pin you entered will be verified manually by an admin. You only need to upload a screenshot if you also have one — it's optional for this method.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container max-w-2xl py-10">
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/upgrade"><ArrowLeft className="h-4 w-4 mr-1" /> Change tier</Link></Button>
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Complete your payment</div>
        <h1 className="font-display text-4xl font-semibold mb-2">Upgrade to {planName}</h1>
        <p className="text-muted-foreground mb-8">Pick your country, choose a payment method, then submit your details.</p>

        <Card className="glass-card p-6 rounded-xl text-center mb-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan: {planName}</div>
          <div className="font-display text-5xl font-semibold mt-2">${usd}</div>
          <div className="text-xs text-muted-foreground mt-3">
            ≈ USD {usd.toFixed(0)}
            {localAmounts.map((a) => ` | ${a.code} ${a.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)}
          </div>
        </Card>

        {/* Country selector */}
        <Card className="glass-card p-4 rounded-xl mb-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Your country</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {COUNTRIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCountry(c.id)}
                className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                  country === c.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="text-2xl mb-1">{c.flag}</div>
                {c.label}
              </button>
            ))}
          </div>
        </Card>

        <Accordion type="single" value={method} onValueChange={(v) => v && setMethod(v)} collapsible={false} className="space-y-3 mb-6">
          {activeCountry.methods.map((m) => {
            const Icon = ICONS[m.icon];
            return (
              <AccordionItem key={m.id} value={m.id} className="glass-card rounded-xl border-0 px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{m.label}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  {renderMethodBody(m)}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <Card className="glass-card p-6 rounded-xl mb-6">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Upload Proof of Payment {activeMethod.proofOptional && <span className="text-muted-foreground/70 normal-case">(optional)</span>}
          </Label>
          <label className="mt-3 block border-2 border-dashed border-border hover:border-primary/40 rounded-lg p-8 text-center cursor-pointer transition-colors">
            <Upload className="h-7 w-7 mx-auto text-primary mb-2" />
            <div className="text-sm font-medium">Click to upload</div>
            <div className="text-xs text-muted-foreground mt-1">Screenshot or PDF of your transaction</div>
            <Input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {file && <div className="text-sm text-muted-foreground mt-3 text-center">📎 {file.name}</div>}

          <Label className="text-xs uppercase tracking-wide text-muted-foreground mt-6 block">Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else the admin should know" maxLength={500} className="mt-2" />
        </Card>

        <Button variant="hero" size="lg" className="w-full h-14 text-base" onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "I Have Paid"}
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

const DetailRow = ({ label, value, onCopy, mono }: { label: string; value: string; onCopy?: () => void; mono?: boolean }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
    <div className="text-xs uppercase tracking-wide text-muted-foreground shrink-0">{label}</div>
    <div className="flex items-center gap-2 min-w-0">
      <div className={`text-sm truncate ${mono ? "font-mono" : ""}`}>{value}</div>
      {onCopy && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCopy}><Copy className="h-3.5 w-3.5" /></Button>}
    </div>
  </div>
);

export default Payment;
