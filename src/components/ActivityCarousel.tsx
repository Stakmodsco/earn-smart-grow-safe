import { useMemo } from "react";
import { ArrowUpRight, BadgeCheck, Banknote } from "lucide-react";
import { currencyForCountry, formatMoney } from "@/lib/currency";

type Item = {
  kind: "withdrawal" | "upgrade";
  name: string;
  country: string; // ISO-2 — drives the currency shown
  place: string;
  amount: number; // canonical USD amount
};

// Globally varied feed — names + locations + currencies are intentionally
// mixed so the marquee always feels like a worldwide platform regardless of
// which country the viewer is in. We never filter this by the viewer's region.
const ITEMS: Item[] = [
  { kind: "withdrawal", name: "Amaka O.",    country: "NG", place: "Lagos",        amount: 120 },
  { kind: "upgrade",    name: "Kwame B.",    country: "GH", place: "Accra",        amount: 50  },
  { kind: "withdrawal", name: "Liam P.",     country: "ZA", place: "Cape Town",    amount: 95  },
  { kind: "upgrade",    name: "Sara K.",     country: "EG", place: "Cairo",        amount: 100 },
  { kind: "withdrawal", name: "Noah W.",     country: "KE", place: "Nairobi",      amount: 60  },
  { kind: "upgrade",    name: "Mei L.",      country: "PH", place: "Manila",       amount: 25  },
  { kind: "withdrawal", name: "Adaeze N.",   country: "NG", place: "Abuja",        amount: 240 },
  { kind: "upgrade",    name: "Jamal R.",    country: "TZ", place: "Dar es Salaam",amount: 50  },
  { kind: "withdrawal", name: "Priya S.",    country: "IN", place: "Mumbai",       amount: 75  },
  { kind: "upgrade",    name: "David O.",    country: "UG", place: "Kampala",      amount: 100 },
  { kind: "withdrawal", name: "Yara F.",     country: "MA", place: "Casablanca",   amount: 50  },
  { kind: "upgrade",    name: "Hassan T.",   country: "PK", place: "Karachi",      amount: 25  },
  { kind: "withdrawal", name: "Emma R.",     country: "GB", place: "London",       amount: 180 },
  { kind: "upgrade",    name: "Lucas G.",    country: "BR", place: "São Paulo",    amount: 100 },
  { kind: "withdrawal", name: "Ana M.",      country: "MX", place: "Mexico City",  amount: 140 },
  { kind: "upgrade",    name: "Yuki S.",     country: "JP", place: "Tokyo",        amount: 50  },
  { kind: "withdrawal", name: "Olivia C.",   country: "AU", place: "Sydney",       amount: 220 },
  { kind: "upgrade",    name: "Marco V.",    country: "IT", place: "Milan",        amount: 25  },
  { kind: "withdrawal", name: "Chloé D.",    country: "FR", place: "Paris",        amount: 160 },
  { kind: "upgrade",    name: "Sven A.",     country: "DE", place: "Berlin",       amount: 100 },
  { kind: "withdrawal", name: "Ethan K.",    country: "CA", place: "Toronto",      amount: 200 },
  { kind: "upgrade",    name: "Tariq H.",    country: "PK", place: "Lahore",       amount: 50  },
  { kind: "withdrawal", name: "Beatrice M.", country: "ZM", place: "Lusaka",       amount: 80  },
  { kind: "upgrade",    name: "Sipho D.",    country: "ZA", place: "Durban",       amount: 25  },
  { kind: "withdrawal", name: "Aisha L.",    country: "SN", place: "Dakar",        amount: 110 },
  { kind: "upgrade",    name: "Hiro T.",     country: "JP", place: "Osaka",        amount: 100 },
  { kind: "withdrawal", name: "Nadia P.",    country: "ID", place: "Jakarta",      amount: 90  },
  { kind: "upgrade",    name: "Omar S.",     country: "AE", place: "Dubai",        amount: 50  },
  { kind: "withdrawal", name: "Sofia R.",    country: "ES", place: "Madrid",       amount: 175 },
  { kind: "upgrade",    name: "Daniel W.",   country: "US", place: "New York",     amount: 100 },
  { kind: "withdrawal", name: "Ruth N.",     country: "RW", place: "Kigali",       amount: 65  },
  { kind: "upgrade",    name: "Linh P.",     country: "VN", place: "Hanoi",        amount: 25  },
  { kind: "withdrawal", name: "Carla B.",    country: "AR", place: "Buenos Aires", amount: 130 },
  { kind: "upgrade",    name: "Idris K.",    country: "NG", place: "Port Harcourt",amount: 50  },
];

export const ActivityCarousel = () => {
  // Shuffle once per mount so the order varies between visits.
  const shuffled = useMemo(() => {
    const arr = [...ITEMS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  // Duplicate for seamless marquee
  const loop = useMemo(() => [...shuffled, ...shuffled], [shuffled]);

  return (
    <div className="w-full bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 border-y border-primary/20 overflow-hidden relative">
      <div className="flex animate-marquee whitespace-nowrap py-2.5">
        {loop.map((it, i) => {
          const meta = currencyForCountry(it.country);
          return (
            <div key={`${it.name}-${i}`} className="flex items-center gap-2 mx-5 text-sm">
              {it.kind === "withdrawal" ? (
                <Banknote className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-accent shrink-0" />
              )}
              <span className="font-medium">{it.name}</span>
              <span className="text-muted-foreground">
                {it.kind === "withdrawal" ? "withdrew" : "upgraded for"}
              </span>
              <span className="font-semibold text-primary tabular-nums">
                {formatMoney(it.amount, meta, { decimals: 0 })}
              </span>
              <span className="text-xs text-muted-foreground">· {it.place}</span>
              <BadgeCheck className="h-3.5 w-3.5 text-primary/70" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
