// Currency localization layer.
//
// All money values in our database are USD. The UI converts and formats them
// according to the user's chosen country (auto-detected from IP, but
// overridable). This file holds:
//   - Country → currency mapping (covers every country in `countries.ts`).
//   - Currency metadata (symbol, code, decimals).
//   - Static FX rates (USD = 1). Approximate, updated on deploy. For an
//     internal display layer this is fine; we never settle in local currency.
//   - `formatMoney(usd, code)` — the single formatter the UI must use.

export type CurrencyCode =
  | "USD" | "EUR" | "GBP" | "ZAR" | "GHS" | "NGN" | "KES" | "UGX" | "TZS"
  | "INR" | "PKR" | "BDT" | "PHP" | "IDR" | "MYR" | "THB" | "VND" | "SGD"
  | "HKD" | "TWD" | "JPY" | "KRW" | "CNY" | "AUD" | "NZD" | "CAD" | "MXN"
  | "BRL" | "ARS" | "CLP" | "COP" | "PEN" | "AED" | "SAR" | "QAR" | "KWD"
  | "EGP" | "MAD" | "DZD" | "TND" | "TRY" | "ILS" | "JOD" | "RUB" | "UAH"
  | "PLN" | "CZK" | "HUF" | "RON" | "BGN" | "SEK" | "NOK" | "DKK" | "CHF"
  | "ISK" | "RSD" | "ETB" | "ZMW" | "MWK" | "MZN" | "AOA" | "RWF" | "BIF"
  | "XOF" | "XAF" | "MGA" | "MUR" | "BWP" | "NAD" | "LSL" | "SZL" | "CDF"
  | "DOP" | "JMD" | "TTD" | "BBD" | "BSD" | "BZD" | "GYD" | "SRD" | "HTG"
  | "CRC" | "GTQ" | "HNL" | "NIO" | "PAB" | "UYU" | "PYG" | "BOB" | "VES"
  | "AFN" | "AMD" | "AZN" | "GEL" | "KZT" | "KGS" | "UZS" | "TJS" | "TMT"
  | "MNT" | "MMK" | "LAK" | "KHR" | "NPR" | "LKR" | "MVR" | "BTN" | "BHD"
  | "OMR" | "YER" | "IQD" | "SYP" | "LBP" | "IRR" | "ALL" | "MKD" | "BAM"
  | "MDL" | "BYN" | "FJD" | "PGK" | "WST" | "TOP" | "SBD" | "VUV" | "XPF"
  | "KPW" | "CUP" | "BMD" | "KYD" | "ANG" | "AWG" | "XCD" | "FKP" | "GIP"
  | "SHP" | "STN" | "SCR" | "DJF" | "ERN" | "GMD" | "GNF" | "LRD" | "LYD"
  | "MOP" | "MRU" | "SDG" | "SLL" | "SOS" | "SSP" | "TJS" | "BND";

export type CurrencyMeta = {
  code: CurrencyCode;
  symbol: string;
  decimals: number;
  // Locale used to format thousands/decimals; falls back to "en-US".
  locale?: string;
};

// Per-currency formatting metadata. Anything not listed defaults to USD-style.
const META: Partial<Record<CurrencyCode, CurrencyMeta>> = {
  USD: { code: "USD", symbol: "$",   decimals: 2 },
  EUR: { code: "EUR", symbol: "€",   decimals: 2, locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£",   decimals: 2 },
  ZAR: { code: "ZAR", symbol: "R",   decimals: 2 },
  GHS: { code: "GHS", symbol: "₵",   decimals: 2 },
  NGN: { code: "NGN", symbol: "₦",   decimals: 2 },
  KES: { code: "KES", symbol: "KSh", decimals: 2 },
  UGX: { code: "UGX", symbol: "USh", decimals: 0 },
  TZS: { code: "TZS", symbol: "TSh", decimals: 0 },
  INR: { code: "INR", symbol: "₹",   decimals: 2, locale: "en-IN" },
  PKR: { code: "PKR", symbol: "₨",   decimals: 0 },
  BDT: { code: "BDT", symbol: "৳",   decimals: 2 },
  PHP: { code: "PHP", symbol: "₱",   decimals: 2 },
  IDR: { code: "IDR", symbol: "Rp",  decimals: 0 },
  MYR: { code: "MYR", symbol: "RM",  decimals: 2 },
  THB: { code: "THB", symbol: "฿",   decimals: 2 },
  VND: { code: "VND", symbol: "₫",   decimals: 0 },
  SGD: { code: "SGD", symbol: "S$",  decimals: 2 },
  HKD: { code: "HKD", symbol: "HK$", decimals: 2 },
  TWD: { code: "TWD", symbol: "NT$", decimals: 0 },
  JPY: { code: "JPY", symbol: "¥",   decimals: 0 },
  KRW: { code: "KRW", symbol: "₩",   decimals: 0 },
  CNY: { code: "CNY", symbol: "¥",   decimals: 2 },
  AUD: { code: "AUD", symbol: "A$",  decimals: 2 },
  NZD: { code: "NZD", symbol: "NZ$", decimals: 2 },
  CAD: { code: "CAD", symbol: "C$",  decimals: 2 },
  MXN: { code: "MXN", symbol: "Mex$",decimals: 2 },
  BRL: { code: "BRL", symbol: "R$",  decimals: 2, locale: "pt-BR" },
  ARS: { code: "ARS", symbol: "AR$", decimals: 0 },
  CLP: { code: "CLP", symbol: "CL$", decimals: 0 },
  COP: { code: "COP", symbol: "CO$", decimals: 0 },
  PEN: { code: "PEN", symbol: "S/.", decimals: 2 },
  AED: { code: "AED", symbol: "د.إ", decimals: 2 },
  SAR: { code: "SAR", symbol: "﷼",   decimals: 2 },
  QAR: { code: "QAR", symbol: "﷼",   decimals: 2 },
  KWD: { code: "KWD", symbol: "KD",  decimals: 3 },
  EGP: { code: "EGP", symbol: "E£",  decimals: 2 },
  MAD: { code: "MAD", symbol: "DH",  decimals: 2 },
  DZD: { code: "DZD", symbol: "DA",  decimals: 2 },
  TND: { code: "TND", symbol: "د.ت", decimals: 3 },
  TRY: { code: "TRY", symbol: "₺",   decimals: 2 },
  ILS: { code: "ILS", symbol: "₪",   decimals: 2 },
  JOD: { code: "JOD", symbol: "JD",  decimals: 3 },
  RUB: { code: "RUB", symbol: "₽",   decimals: 2 },
  UAH: { code: "UAH", symbol: "₴",   decimals: 2 },
  PLN: { code: "PLN", symbol: "zł",  decimals: 2 },
  CZK: { code: "CZK", symbol: "Kč",  decimals: 2 },
  HUF: { code: "HUF", symbol: "Ft",  decimals: 0 },
  RON: { code: "RON", symbol: "lei", decimals: 2 },
  BGN: { code: "BGN", symbol: "лв",  decimals: 2 },
  SEK: { code: "SEK", symbol: "kr",  decimals: 2 },
  NOK: { code: "NOK", symbol: "kr",  decimals: 2 },
  DKK: { code: "DKK", symbol: "kr",  decimals: 2 },
  CHF: { code: "CHF", symbol: "CHF", decimals: 2 },
};

// Approximate USD→local rates. Updated periodically.
// Anything not listed falls through to USD (rate 1).
const RATES: Partial<Record<CurrencyCode, number>> = {
  USD: 1,
  EUR: 0.92, GBP: 0.79, ZAR: 18.5, GHS: 15, NGN: 1481.47, KES: 129, UGX: 3700,
  TZS: 2500, INR: 83, PKR: 278, BDT: 110, PHP: 56, IDR: 15700, MYR: 4.7,
  THB: 35, VND: 25000, SGD: 1.34, HKD: 7.8, TWD: 31.5, JPY: 156, KRW: 1370,
  CNY: 7.2, AUD: 1.52, NZD: 1.66, CAD: 1.36, MXN: 17.3, BRL: 5.05, ARS: 880,
  CLP: 920, COP: 4000, PEN: 3.78, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31,
  EGP: 47, MAD: 10, DZD: 134, TND: 3.1, TRY: 32.5, ILS: 3.7, JOD: 0.71,
  RUB: 92, UAH: 39, PLN: 4, CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, SEK: 10.5,
  NOK: 10.8, DKK: 6.85, CHF: 0.91, ETB: 56, ZMW: 26, MWK: 1700, MZN: 64,
  AOA: 850, RWF: 1300, BIF: 2870, XOF: 605, XAF: 605, MGA: 4500, MUR: 46,
  BWP: 13.5, NAD: 18.5, LSL: 18.5, SZL: 18.5, CDF: 2700, DOP: 59, JMD: 156,
  TTD: 6.8, BBD: 2, BSD: 1, BZD: 2, GYD: 209, SRD: 35, HTG: 132, CRC: 510,
  GTQ: 7.8, HNL: 24.7, NIO: 36.6, PAB: 1, UYU: 39, PYG: 7400, BOB: 6.9,
  VES: 36.5, AFN: 71, AMD: 388, AZN: 1.7, GEL: 2.7, KZT: 460, KGS: 88,
  UZS: 12500, TJS: 10.9, TMT: 3.5, MNT: 3400, MMK: 2100, LAK: 21000, KHR: 4080,
  NPR: 133, LKR: 305, MVR: 15.4, BTN: 83, BHD: 0.38, OMR: 0.38, YER: 250,
  IQD: 1310, SYP: 13000, LBP: 89500, IRR: 42000, ALL: 95, MKD: 56, BAM: 1.8,
  MDL: 17.7, BYN: 3.27, FJD: 2.27, PGK: 3.85, WST: 2.74, TOP: 2.36, SBD: 8.4,
  VUV: 119, XPF: 110, KPW: 900, CUP: 24, BMD: 1, KYD: 0.83, ANG: 1.79,
  AWG: 1.79, XCD: 2.7, FKP: 0.79, GIP: 0.79, SHP: 0.79, STN: 22.6, SCR: 13.5,
  DJF: 178, ERN: 15, GMD: 67, GNF: 8600, LRD: 192, LYD: 4.85, MOP: 8,
  MRU: 39.7, SDG: 600, SLL: 22600, SOS: 571, SSP: 1300, BND: 1.34,
};

// ISO country code → primary currency.
const COUNTRY_CCY: Record<string, CurrencyCode> = {
  // Africa
  ZA: "ZAR", GH: "GHS", NG: "NGN", KE: "KES", UG: "UGX", TZ: "TZS",
  ET: "ETB", ZM: "ZMW", MW: "MWK", MZ: "MZN", AO: "AOA", RW: "RWF",
  BI: "BIF", SN: "XOF", CI: "XOF", BF: "XOF", ML: "XOF", NE: "XOF",
  TG: "XOF", BJ: "XOF", GW: "XOF", CM: "XAF", CF: "XAF", TD: "XAF",
  CG: "XAF", GA: "XAF", GQ: "XAF", MG: "MGA", MU: "MUR", BW: "BWP",
  NA: "NAD", LS: "LSL", SZ: "SZL", CD: "CDF", EG: "EGP", MA: "MAD",
  DZ: "DZD", TN: "TND", LY: "LYD", SD: "SDG", SS: "SSP", SO: "SOS",
  ER: "ERN", DJ: "DJF", GM: "GMD", GN: "GNF", LR: "LRD", SL: "SLL",
  SC: "SCR", ST: "STN", MR: "MRU", CV: "USD", KM: "USD", EH: "MAD",
  RE: "EUR", YT: "EUR", SH: "SHP",
  // MENA
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR",
  JO: "JOD", LB: "LBP", IL: "ILS", PS: "ILS", TR: "TRY", IR: "IRR",
  IQ: "IQD", SY: "SYP", YE: "YER",
  // Europe
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
  SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR",
  MT: "EUR", AD: "EUR", MC: "EUR", SM: "EUR", VA: "EUR", ME: "EUR",
  XK: "EUR", GB: "GBP", JE: "GBP", GG: "GBP", IM: "GBP", GI: "GIP",
  CH: "CHF", LI: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", HR: "EUR",
  RS: "RSD", BA: "BAM", MK: "MKD", AL: "ALL", MD: "MDL", BY: "BYN",
  UA: "UAH", RU: "RUB", FO: "DKK", SJ: "NOK",
  // Asia
  IN: "INR", PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR", BT: "BTN",
  MV: "MVR", AF: "AFN", PH: "PHP", ID: "IDR", MY: "MYR", TH: "THB",
  VN: "VND", SG: "SGD", HK: "HKD", MO: "MOP", TW: "TWD", JP: "JPY",
  KR: "KRW", KP: "KPW", CN: "CNY", MM: "MMK", LA: "LAK", KH: "KHR",
  BN: "BND", TL: "USD", MN: "MNT", KZ: "KZT", KG: "KGS", UZ: "UZS",
  TJ: "TJS", TM: "TMT", AM: "AMD", AZ: "AZN", GE: "GEL",
  // Oceania
  AU: "AUD", NZ: "NZD", FJ: "FJD", PG: "PGK", WS: "WST", TO: "TOP",
  SB: "SBD", VU: "VUV", PF: "XPF", NC: "XPF", WF: "XPF", AS: "USD",
  GU: "USD", MP: "USD", MH: "USD", FM: "USD", PW: "USD", NR: "AUD",
  KI: "AUD", TV: "AUD", CK: "NZD", NU: "NZD", TK: "NZD", PN: "NZD",
  CX: "AUD", CC: "AUD", NF: "AUD",
  // Americas
  US: "USD", CA: "CAD", MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP",
  CO: "COP", PE: "PEN", UY: "UYU", PY: "PYG", BO: "BOB", VE: "VES",
  EC: "USD", GY: "GYD", SR: "SRD", GF: "EUR", DO: "DOP", JM: "JMD",
  TT: "TTD", BB: "BBD", BS: "BSD", BZ: "BZD", HT: "HTG", CR: "CRC",
  GT: "GTQ", HN: "HNL", NI: "NIO", PA: "PAB", SV: "USD", CU: "CUP",
  PR: "USD", VI: "USD", KY: "KYD", BM: "BMD", VG: "USD", TC: "USD",
  AI: "XCD", AG: "XCD", DM: "XCD", GD: "XCD", KN: "XCD", LC: "XCD",
  VC: "XCD", MS: "XCD", AW: "AWG", CW: "ANG", SX: "ANG", BL: "EUR",
  MF: "EUR", MQ: "EUR", GP: "EUR", PM: "EUR", FK: "FKP",
  // Antarctica & misc
  GL: "DKK", AQ: "USD", IO: "USD", IT_VA: "EUR",
};

const DEFAULT_META: CurrencyMeta = { code: "USD", symbol: "$", decimals: 2 };

export const currencyForCountry = (countryCode?: string | null): CurrencyMeta => {
  if (!countryCode) return DEFAULT_META;
  const ccy = COUNTRY_CCY[countryCode.toUpperCase()];
  if (!ccy) return DEFAULT_META;
  return META[ccy] ?? { code: ccy, symbol: ccy + " ", decimals: 2 };
};

export const fxRate = (code: CurrencyCode): number => RATES[code] ?? 1;

// Convert a USD amount to the target currency.
export const convertUsd = (usd: number, code: CurrencyCode): number =>
  Number(usd) * fxRate(code);

// Format a USD amount as the user's local currency.
// `opts.usdHint` appends the original USD value (useful for canonical pricing).
export function formatMoney(
  usd: number | string | null | undefined,
  meta: CurrencyMeta = DEFAULT_META,
  opts: { decimals?: number; signed?: boolean; usdHint?: boolean } = {},
): string {
  const n = Number(usd ?? 0);
  if (!Number.isFinite(n)) return `${meta.symbol}0`;
  const local = convertUsd(n, meta.code);
  const decimals = opts.decimals ?? meta.decimals;
  const sign = opts.signed && n > 0 ? "+" : "";
  const formatted = local.toLocaleString(meta.locale ?? "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const main = `${sign}${meta.symbol}${formatted}`;
  return opts.usdHint && meta.code !== "USD"
    ? `${main} (≈ $${n.toFixed(2)})`
    : main;
}
