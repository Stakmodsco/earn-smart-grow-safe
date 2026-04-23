import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, ShieldCheck, BarChart3, CheckCircle2, Sparkles, Lock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const tiers = [
  { name: "Starter", price: "Free", level: 0, features: ["Daily check-in (small reward)", "Browse tasks", "Verify your identity"], cta: "Create account" },
  { name: "Bronze", price: "$25", level: 1, features: ["Watch & Earn unlocked", "Spin & Win unlocked", "$5 daily earning cap", "$50 daily withdrawal"], cta: "Upgrade to Bronze" },
  { name: "Silver", price: "$50", level: 2, features: ["Higher per-task rewards", "$15 daily earning cap", "$200 daily withdrawal", "Referral commission boost"], cta: "Upgrade to Silver", popular: true },
  { name: "Gold", price: "$100", level: 3, features: ["Top per-task rewards", "$40 daily earning cap", "$500 daily withdrawal", "Priority withdrawal review"], cta: "Upgrade to Gold" },
];

const Index = () => {
  const [stats, setStats] = useState({ payouts: 0, users: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: users }, { data: payouts }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("withdrawals").select("amount").eq("status", "completed"),
      ]);
      const total = (payouts ?? []).reduce((s, w: any) => s + Number(w.amount), 0);
      setStats({ users: users ?? 0, payouts: total });
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container py-24 md:py-32 max-w-5xl">
          <div className="animate-fade-in">
            <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.05] text-balance">
              Earn through structured
              <span className="block bg-gradient-emerald bg-clip-text text-transparent"> digital activities.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl text-balance">
              Monetra is a membership rewards platform with controlled payouts, daily caps, and admin-reviewed withdrawals — designed to feel like a real fintech product, not a quick-money scheme.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Button asChild size="xl" variant="hero">
                <Link to="/auth?mode=signup">Open your account <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <a href="#how">See how it works</a>
              </Button>
            </div>

            <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-6">
              <Stat label="Total payouts processed" value={`$${stats.payouts.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <Stat label="Active members" value={stats.users.toLocaleString()} />
              <Stat label="Avg. review time" value="< 24h" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container py-24">
        <SectionHeader eyebrow="How Monetra works" title="Three steps. No surprises." />
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {[
            { icon: Users, title: "1. Create an account", desc: "Sign up free at Level 0. Optional referral code links you to your inviter." },
            { icon: Sparkles, title: "2. Complete daily activities", desc: "Check in once per 24h, complete server-validated tasks. Every reward respects your daily cap." },
            { icon: ShieldCheck, title: "3. Withdraw with admin review", desc: "Request payout above the minimum. Funds lock instantly and are released after manual review." },
          ].map((s, i) => (
            <Card key={i} className="glass-card p-8 rounded-xl">
              <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center mb-5">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section id="tiers" className="container py-24">
        <SectionHeader eyebrow="Membership tiers" title="Choose your earning ceiling." subtitle="Higher tiers unlock larger daily caps and faster withdrawal limits. There are no hidden fees and no exaggerated promises." />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {tiers.map((t) => (
            <Card key={t.name} className={`glass-card p-7 rounded-xl flex flex-col relative ${t.popular ? "ring-1 ring-primary/40 emerald-glow" : ""}`}>
              {t.popular && <div className="absolute -top-3 left-7 text-xs bg-gradient-emerald text-primary-foreground px-2.5 py-1 rounded-full font-medium">Most popular</div>}
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-display text-2xl font-semibold">{t.name}</h3>
                <span className="text-xs text-muted-foreground">L{t.level}</span>
              </div>
              <div className="text-3xl font-display font-semibold mb-6">{t.price}</div>
              <ul className="space-y-2.5 text-sm text-muted-foreground flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{f}</span></li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant={t.popular ? "hero" : "outline"}>
                <Link to={t.level === 0 ? "/auth?mode=signup" : "/upgrade"}>{t.cta}</Link>
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="container py-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Lock, title: "Server-validated rewards", desc: "Every check-in, task, and withdrawal is verified server-side. No client-side balance tampering." },
            { icon: BarChart3, title: "Hard daily caps", desc: "Earnings are capped per level — no infinite earning loops. Caps are visible in your dashboard." },
            { icon: ShieldCheck, title: "Manual withdrawal review", desc: "Withdrawals lock funds, then a human admin processes payouts within 24 hours." },
          ].map((s) => (
            <Card key={s.title} className="glass-card p-7 rounded-xl">
              <s.icon className="h-5 w-5 text-primary mb-4" />
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container py-24 max-w-3xl">
        <SectionHeader eyebrow="FAQ" title="Earning rules, explained." />
        <Accordion type="single" collapsible className="mt-10">
          {[
            { q: "How fast can I withdraw?", a: "Minimum withdrawal is $50. Once submitted, your funds move from Available to Locked balance and a human admin processes the payout — usually within 24 hours." },
            { q: "Can I earn without upgrading?", a: "Level 0 (free) members get a small daily check-in reward and can browse the platform. Watch & Earn and Spin & Win require Level 1+." },
            { q: "What happens if I miss a check-in?", a: "Missed days do not stack. The check-in resets 24 hours after your last claim — there is no streak bonus or backlog." },
            { q: "How do referrals work?", a: "Each member gets a unique referral code. You earn a 10% commission on Level-1 referrals' approved upgrades and a smaller commission on Level-2 referrals. Daily referral cap applies." },
            { q: "Why are caps and reviews so strict?", a: "To keep Monetra sustainable. Unlimited rewards always collapse. Caps + manual review let us keep paying members reliably for the long term." },
          ].map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="border-t border-border/60 mt-12">
        <div className="container py-10 flex flex-col md:flex-row justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Monetra. All rights reserved.</div>
          <div>Earnings depend on activity and tier. Subject to platform terms.</div>
        </div>
      </footer>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="font-display text-3xl font-semibold">{value}</div>
    <div className="text-sm text-muted-foreground mt-1">{label}</div>
  </div>
);

const SectionHeader = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => (
  <div className="max-w-2xl">
    <div className="text-xs uppercase tracking-widest text-primary mb-3">{eyebrow}</div>
    <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight text-balance">{title}</h2>
    {subtitle && <p className="mt-4 text-muted-foreground text-lg text-balance">{subtitle}</p>}
  </div>
);

export default Index;
