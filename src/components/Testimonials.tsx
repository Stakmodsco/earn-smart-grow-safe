import { Card } from "@/components/ui/card";
import { Quote, Star } from "lucide-react";
import { useMemo } from "react";
import { useCurrency } from "@/hooks/useCurrency";

type T = { name: string; role: string; quote: string };

const TESTIMONIALS: T[] = [
  { name: "Amaka O.", role: "Lagos, Nigeria",     quote: "Withdrew my first $120 in under 10 minutes. Process was painless." },
  { name: "Kwame B.", role: "Accra, Ghana",        quote: "Loved the daily check-in habit. Small wins really add up." },
  { name: "Liam P.",  role: "Cape Town, SA",       quote: "The vouchers worked instantly. Support replied in seconds." },
  { name: "Sara K.",  role: "Cairo, Egypt",        quote: "Upgraded to Gold and unlocked tons of tasks. Worth it." },
  { name: "Noah W.",  role: "Nairobi, Kenya",      quote: "Finally a rewards platform that pays without drama." },
  { name: "Mei L.",   role: "Manila, Philippines", quote: "Referral commissions hit my balance the moment my friends upgraded." },
  { name: "Adaeze N.",role: "Abuja, Nigeria",      quote: "Caps and rules are clear. No fake promises." },
  { name: "Jamal R.", role: "Dar es Salaam, TZ",   quote: "Customer-first design. The mobile UX is so smooth." },
  { name: "Priya S.", role: "Mumbai, India",       quote: "Submitted my screenshot and got approved in minutes." },
  { name: "David O.", role: "Kampala, Uganda",     quote: "Got my first payout via Airtel Money the same day." },
  { name: "Yara F.",  role: "Casablanca, Morocco", quote: "I love how every reward is logged transparently." },
  { name: "Hassan T.",role: "Karachi, Pakistan",   quote: "Easy onboarding. The bonus on signup was a nice touch." },
  { name: "Tariq H.", role: "Lahore, Pakistan",    quote: "Withdrawals are now actually automated and instant." },
  { name: "Beatrice M.", role: "Lusaka, Zambia",   quote: "I tell all my friends — Cheddar4u just delivers." },
  { name: "Sipho D.", role: "Durban, SA",          quote: "Transparent caps mean I always know what I'll earn." },
  { name: "Aisha L.", role: "Dakar, Senegal",      quote: "Best rewards app I've used. Period." },
];

export const Testimonials = () => {
  const { format } = useCurrency();
  const localized = TESTIMONIALS.map((t) => ({
    ...t,
    quote: t.quote.replace("$120", format(120, { decimals: 0 })),
  }));
  // Duplicate for seamless marquee
  const loop = useMemo(() => [...localized, ...localized], [localized]);
  return (
    <section className="container py-20 max-w-6xl">
      <div className="text-center mb-10">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Testimonials</div>
        <h2 className="font-display text-4xl md:text-5xl font-semibold">Trusted by members worldwide</h2>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Real members. Real payouts. Real reviews.</p>
      </div>
      <div className="relative overflow-hidden">
        {/* edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex gap-4 animate-marquee-slow w-max">
          {loop.map((t, i) => (
            <Card key={`${t.name}-${i}`} className="glass-card p-6 rounded-xl w-[320px] shrink-0">
              <Quote className="h-5 w-5 text-primary mb-3" />
              <p className="text-sm leading-relaxed mb-4">{t.quote}</p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-warning text-warning" />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
