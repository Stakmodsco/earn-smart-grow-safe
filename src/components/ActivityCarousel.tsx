import { useMemo } from "react";
import { ArrowUpRight, BadgeCheck, Banknote } from "lucide-react";
import { currencyForCountry, formatMoney } from "@/lib/currency";

type Item = {
  kind: "withdrawal" | "upgrade";
  name: string;
  country: string;
  place: string;
  amount: number;
};

// Globally varied feed — names + locations + currencies mix so the marquee
// always feels worldwide. Heavily weighted toward withdrawals (people love
// seeing other people get paid). Every name in this list is unique.
const ITEMS: Item[] = [
  // Withdrawals — Africa
  { kind: "withdrawal", name: "Amaka O.",     country: "NG", place: "Lagos",         amount: 120 },
  { kind: "withdrawal", name: "Tunde A.",     country: "NG", place: "Abuja",         amount: 240 },
  { kind: "withdrawal", name: "Chiamaka E.",  country: "NG", place: "Enugu",         amount: 85  },
  { kind: "withdrawal", name: "Idris K.",     country: "NG", place: "Port Harcourt", amount: 310 },
  { kind: "withdrawal", name: "Folake D.",    country: "NG", place: "Ibadan",        amount: 175 },
  { kind: "withdrawal", name: "Kwame B.",     country: "GH", place: "Accra",         amount: 90  },
  { kind: "withdrawal", name: "Akosua P.",    country: "GH", place: "Kumasi",        amount: 145 },
  { kind: "withdrawal", name: "Yaw M.",       country: "GH", place: "Tema",          amount: 60  },
  { kind: "withdrawal", name: "Liam P.",      country: "ZA", place: "Cape Town",     amount: 95  },
  { kind: "withdrawal", name: "Sipho D.",     country: "ZA", place: "Durban",        amount: 220 },
  { kind: "withdrawal", name: "Thandi M.",    country: "ZA", place: "Johannesburg",  amount: 130 },
  { kind: "withdrawal", name: "Sara K.",      country: "EG", place: "Cairo",         amount: 100 },
  { kind: "withdrawal", name: "Mostafa H.",   country: "EG", place: "Alexandria",    amount: 75  },
  { kind: "withdrawal", name: "Noah W.",      country: "KE", place: "Nairobi",       amount: 60  },
  { kind: "withdrawal", name: "Wanjiku G.",   country: "KE", place: "Mombasa",       amount: 165 },
  { kind: "withdrawal", name: "Adaeze N.",    country: "NG", place: "Kano",          amount: 240 },
  { kind: "withdrawal", name: "Jamal R.",     country: "TZ", place: "Dar es Salaam", amount: 80  },
  { kind: "withdrawal", name: "Zuri F.",      country: "TZ", place: "Arusha",        amount: 120 },
  { kind: "withdrawal", name: "David O.",     country: "UG", place: "Kampala",       amount: 100 },
  { kind: "withdrawal", name: "Esther B.",    country: "UG", place: "Entebbe",       amount: 55  },
  { kind: "withdrawal", name: "Yara F.",      country: "MA", place: "Casablanca",    amount: 50  },
  { kind: "withdrawal", name: "Karim Z.",     country: "MA", place: "Rabat",         amount: 190 },
  { kind: "withdrawal", name: "Beatrice M.",  country: "ZM", place: "Lusaka",        amount: 80  },
  { kind: "withdrawal", name: "Kabelo R.",    country: "BW", place: "Gaborone",      amount: 140 },
  { kind: "withdrawal", name: "Aisha L.",     country: "SN", place: "Dakar",         amount: 110 },
  { kind: "withdrawal", name: "Mariam C.",    country: "CI", place: "Abidjan",       amount: 95  },
  { kind: "withdrawal", name: "Ruth N.",      country: "RW", place: "Kigali",        amount: 65  },
  { kind: "withdrawal", name: "Selam G.",     country: "ET", place: "Addis Ababa",   amount: 105 },
  // Withdrawals — Asia
  { kind: "withdrawal", name: "Mei L.",       country: "PH", place: "Manila",        amount: 70  },
  { kind: "withdrawal", name: "Ramon V.",     country: "PH", place: "Cebu",          amount: 125 },
  { kind: "withdrawal", name: "Priya S.",     country: "IN", place: "Mumbai",        amount: 75  },
  { kind: "withdrawal", name: "Arjun K.",     country: "IN", place: "Bengaluru",     amount: 210 },
  { kind: "withdrawal", name: "Neha R.",      country: "IN", place: "Delhi",         amount: 160 },
  { kind: "withdrawal", name: "Hassan T.",    country: "PK", place: "Karachi",       amount: 95  },
  { kind: "withdrawal", name: "Tariq H.",     country: "PK", place: "Lahore",        amount: 50  },
  { kind: "withdrawal", name: "Yuki S.",      country: "JP", place: "Tokyo",         amount: 180 },
  { kind: "withdrawal", name: "Hiro T.",      country: "JP", place: "Osaka",         amount: 100 },
  { kind: "withdrawal", name: "Nadia P.",     country: "ID", place: "Jakarta",       amount: 90  },
  { kind: "withdrawal", name: "Budi A.",      country: "ID", place: "Surabaya",      amount: 135 },
  { kind: "withdrawal", name: "Linh P.",      country: "VN", place: "Hanoi",         amount: 85  },
  { kind: "withdrawal", name: "Minh Q.",      country: "VN", place: "Ho Chi Minh",   amount: 150 },
  { kind: "withdrawal", name: "Omar S.",      country: "AE", place: "Dubai",         amount: 320 },
  { kind: "withdrawal", name: "Layla J.",     country: "AE", place: "Abu Dhabi",     amount: 250 },
  { kind: "withdrawal", name: "Wei C.",       country: "MY", place: "Kuala Lumpur",  amount: 110 },
  { kind: "withdrawal", name: "Siti N.",      country: "MY", place: "Penang",        amount: 75  },
  { kind: "withdrawal", name: "Chai P.",      country: "TH", place: "Bangkok",       amount: 140 },
  // Withdrawals — Europe
  { kind: "withdrawal", name: "Emma R.",      country: "GB", place: "London",        amount: 220 },
  { kind: "withdrawal", name: "Oliver T.",    country: "GB", place: "Manchester",    amount: 165 },
  { kind: "withdrawal", name: "Chloé D.",     country: "FR", place: "Paris",         amount: 160 },
  { kind: "withdrawal", name: "Antoine M.",   country: "FR", place: "Lyon",          amount: 90  },
  { kind: "withdrawal", name: "Sven A.",      country: "DE", place: "Berlin",        amount: 200 },
  { kind: "withdrawal", name: "Lara H.",      country: "DE", place: "Munich",        amount: 145 },
  { kind: "withdrawal", name: "Sofia R.",     country: "ES", place: "Madrid",        amount: 175 },
  { kind: "withdrawal", name: "Pablo I.",     country: "ES", place: "Barcelona",     amount: 110 },
  { kind: "withdrawal", name: "Marco V.",     country: "IT", place: "Milan",         amount: 130 },
  { kind: "withdrawal", name: "Giulia F.",    country: "IT", place: "Rome",          amount: 95  },
  { kind: "withdrawal", name: "Anders L.",    country: "SE", place: "Stockholm",     amount: 240 },
  { kind: "withdrawal", name: "Niamh C.",     country: "IE", place: "Dublin",        amount: 180 },
  { kind: "withdrawal", name: "Janek W.",     country: "PL", place: "Warsaw",        amount: 120 },
  { kind: "withdrawal", name: "Ivana B.",     country: "RS", place: "Belgrade",      amount: 80  },
  // Withdrawals — Americas / Oceania
  { kind: "withdrawal", name: "Lucas G.",     country: "BR", place: "São Paulo",     amount: 175 },
  { kind: "withdrawal", name: "Camila V.",    country: "BR", place: "Rio de Janeiro",amount: 250 },
  { kind: "withdrawal", name: "Ana M.",       country: "MX", place: "Mexico City",   amount: 140 },
  { kind: "withdrawal", name: "Diego H.",     country: "MX", place: "Guadalajara",   amount: 105 },
  { kind: "withdrawal", name: "Carla B.",     country: "AR", place: "Buenos Aires",  amount: 130 },
  { kind: "withdrawal", name: "Mateo Q.",     country: "CL", place: "Santiago",      amount: 95  },
  { kind: "withdrawal", name: "Daniel W.",    country: "US", place: "New York",      amount: 410 },
  { kind: "withdrawal", name: "Jasmine K.",   country: "US", place: "Los Angeles",   amount: 285 },
  { kind: "withdrawal", name: "Marcus T.",    country: "US", place: "Atlanta",       amount: 195 },
  { kind: "withdrawal", name: "Ethan K.",     country: "CA", place: "Toronto",       amount: 200 },
  { kind: "withdrawal", name: "Maple S.",     country: "CA", place: "Vancouver",     amount: 145 },
  { kind: "withdrawal", name: "Olivia C.",    country: "AU", place: "Sydney",        amount: 220 },
  { kind: "withdrawal", name: "Hugo P.",      country: "AU", place: "Melbourne",     amount: 165 },
  // Upgrades — sprinkled in
  { kind: "upgrade",    name: "Bilal K.",     country: "PK", place: "Islamabad",     amount: 25  },
  { kind: "upgrade",    name: "Gloria O.",    country: "NG", place: "Lagos",         amount: 50  },
  { kind: "upgrade",    name: "Henry W.",     country: "KE", place: "Nairobi",       amount: 100 },
  { kind: "upgrade",    name: "Nina J.",      country: "DE", place: "Hamburg",       amount: 50  },
  { kind: "upgrade",    name: "Tomás L.",     country: "BR", place: "Brasília",      amount: 25  },
  { kind: "upgrade",    name: "Aroha W.",     country: "NZ", place: "Auckland",      amount: 100 },
  { kind: "upgrade",    name: "Rashid Y.",    country: "AE", place: "Sharjah",       amount: 50  },
  { kind: "upgrade",    name: "Bella V.",     country: "IT", place: "Florence",      amount: 25  },
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

  // Duplicate for seamless marquee loop (visual repeat only — names stay unique
  // within the source list).
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
