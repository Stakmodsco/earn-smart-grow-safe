import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  balance: number;
  locked_balance: number;
  total_earnings: number;
  level: number;
  referral_code: string;
  referred_by: string | null;
  last_checkin: string | null;
  daily_earned: number;
  daily_earned_date: string | null;
  flagged: boolean;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

// ─── Shared realtime profile subscription ─────────────────────────────────────
// Multiple components (page + UpgradeNagModal + nav, etc.) may call
// useProfile() with the same userId. Supabase only allows one subscribed
// channel per name, so we share a single channel per userId via a registry
// with reference counting. Each tab also gets its own random channel suffix
// so that multiple tabs of the same logged-in user don't collide either.

type Listener = (p: Profile) => void;

type Entry = {
  channelName: string;
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<Listener>;
  refCount: number;
};

const TAB_ID = Math.random().toString(36).slice(2, 10);
const registry = new Map<string, Entry>();

function dlog(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.debug("[realtime/profile]", ...args);
}

function subscribeProfile(userId: string, listener: Listener): () => void {
  let entry = registry.get(userId);
  if (!entry) {
    const channelName = `profile:${userId}:${TAB_ID}`;
    dlog("creating channel", channelName);
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const next = payload.new as Profile;
          dlog("update received", channelName);
          entry?.listeners.forEach((fn) => {
            try { fn(next); } catch (e) { console.error("[realtime/profile] listener error", e); }
          });
        },
      )
      .subscribe((status) => dlog("status", channelName, status));

    entry = { channelName, channel, listeners: new Set(), refCount: 0 };
    registry.set(userId, entry);
  }

  entry.listeners.add(listener);
  entry.refCount += 1;
  dlog("subscribe", entry.channelName, "refCount=", entry.refCount);

  return () => {
    const e = registry.get(userId);
    if (!e) return;
    e.listeners.delete(listener);
    e.refCount -= 1;
    dlog("unsubscribe", e.channelName, "refCount=", e.refCount);
    if (e.refCount <= 0) {
      dlog("tearing down channel", e.channelName);
      supabase.removeChannel(e.channel);
      registry.delete(userId);
    }
  };
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!userId) { setProfile(null); setLoading(false); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data as Profile | null);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeProfile(userId, (p) => setProfile(p));
    return () => {
      unsubscribe();
    };
  }, [userId]);

  return { profile, loading, refresh };
}

export function useIsAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!userId) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [userId]);
  return isAdmin;
}
