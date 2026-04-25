import { useEffect, useState } from "react";
import { findCountryByCode, type CountryEntry } from "@/lib/countries";

const STORAGE_KEY = "monetra:geo-country";

// Detects the user's country from their IP via Cloudflare's no-key trace
// endpoint (`https://www.cloudflare.com/cdn-cgi/trace`). The result is cached
// in localStorage for the session so we don't hammer the endpoint on every
// page navigation.
//
// Returns:
//   - country: the resolved CountryEntry, or null while detecting / on failure
//   - loading: true while the IP lookup is in flight
//   - source: "cache" | "ip" | "fallback" — purely diagnostic
export function useGeoCountry() {
  const [country, setCountry] = useState<CountryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"cache" | "ip" | "fallback">("fallback");

  useEffect(() => {
    let cancelled = false;

    // 1. Try cache first to avoid the network hop.
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const c = findCountryByCode(cached);
        if (c) {
          setCountry(c);
          setSource("cache");
          setLoading(false);
          return;
        }
      }
    } catch {
      // localStorage may be disabled — ignore.
    }

    // 2. Hit Cloudflare trace. It returns a tiny `key=value\n` payload.
    (async () => {
      try {
        const res = await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`trace returned ${res.status}`);
        const text = await res.text();
        const map = Object.fromEntries(
          text
            .trim()
            .split("\n")
            .map((line) => {
              const idx = line.indexOf("=");
              return idx === -1 ? [line, ""] : [line.slice(0, idx), line.slice(idx + 1)];
            }),
        );
        const cc = (map.loc ?? "").toUpperCase();
        const c = findCountryByCode(cc);
        if (cancelled) return;
        if (c) {
          setCountry(c);
          setSource("ip");
          try { localStorage.setItem(STORAGE_KEY, c.code); } catch { /* ignore */ }
        } else {
          setSource("fallback");
        }
      } catch (e) {
        // Network blocked / offline — fall through to manual selection.
        // eslint-disable-next-line no-console
        console.warn("[geo] country detection failed", e);
        setSource("fallback");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { country, loading, source };
}
