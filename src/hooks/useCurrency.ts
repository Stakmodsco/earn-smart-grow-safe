import { useEffect, useMemo, useState, useCallback } from "react";
import { useGeoCountry } from "@/hooks/useGeoCountry";
import { currencyForCountry, formatMoney as fmt, type CurrencyMeta } from "@/lib/currency";

const OVERRIDE_KEY = "monetra:currency-country-override";

// Returns the currency to use for the current user.
// Resolution order:
//   1. Manual override saved in localStorage (set via Profile or Payment page).
//   2. Country detected from IP via Cloudflare trace.
//   3. USD fallback.
//
// Provides:
//   - meta:        full currency metadata (symbol, code, decimals, locale).
//   - countryCode: the ISO-2 code that produced the currency.
//   - format(usd): formatter that converts USD → local & renders the symbol.
//   - setOverride(code): manually pin a country (e.g. "GB"). null clears it.
export function useCurrency() {
  const { country: geoCountry, loading } = useGeoCountry();
  const [override, setOverride] = useState<string | null>(() => {
    try { return localStorage.getItem(OVERRIDE_KEY); } catch { return null; }
  });

  const countryCode = override ?? geoCountry?.code ?? null;
  const meta: CurrencyMeta = useMemo(() => currencyForCountry(countryCode), [countryCode]);

  useEffect(() => {
    try {
      if (override) localStorage.setItem(OVERRIDE_KEY, override);
      else localStorage.removeItem(OVERRIDE_KEY);
    } catch { /* ignore */ }
  }, [override]);

  const format = useCallback(
    (usd: number | string | null | undefined, opts?: Parameters<typeof fmt>[2]) =>
      fmt(usd, meta, opts),
    [meta],
  );

  return {
    meta,
    countryCode,
    loading,
    format,
    setOverride,
    override,
  };
}
