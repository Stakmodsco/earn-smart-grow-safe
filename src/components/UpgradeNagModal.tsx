import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { Crown, Sparkles, X } from "lucide-react";

// Show every N ms while the user is logged in but not upgraded.
const NAG_INTERVAL_MS = 90_000; // 1m30s
// Snooze when user clicks "Not now"
const SNOOZE_MS = 60_000;
// Per-tab key used to remember that the user clicked "Upgrade" — the nag
// stays paused until either the upgrade lands (level > 0) OR the user
// explicitly cancels.
const UPGRADE_INTENT_KEY = "monetra:upgradeIntent";

export const UpgradeNagModal = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const nextAtRef = useRef<number>(Date.now() + NAG_INTERVAL_MS);
  const pausedRef = useRef(false);

  // The user is "in the upgrade flow" if they're on /upgrade or /payment/*.
  const onPaymentFlow = pathname.startsWith("/payment") || pathname === "/upgrade";

  // Read upgrade-intent flag (set when user clicks "Upgrade now").
  const hasUpgradeIntent = () => {
    try { return sessionStorage.getItem(UPGRADE_INTENT_KEY) === "1"; }
    catch { return false; }
  };
  const setUpgradeIntent = (v: boolean) => {
    try {
      if (v) sessionStorage.setItem(UPGRADE_INTENT_KEY, "1");
      else sessionStorage.removeItem(UPGRADE_INTENT_KEY);
    } catch { /* ignore */ }
  };

  // Clear the intent flag the moment the user actually upgrades.
  useEffect(() => {
    if (profile && (profile.level ?? 0) > 0) setUpgradeIntent(false);
  }, [profile]);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if ((profile.level ?? 0) > 0) return; // already upgraded — never nag
    if (profile.flagged) return;

    // If they've expressed upgrade intent, suppress the nag entirely until
    // either the upgrade completes (handled above) or they cancel from the
    // modal itself. They can still navigate freely (e.g. to read FAQ) without
    // the popup interrupting them.
    if (hasUpgradeIntent()) {
      pausedRef.current = true;
      setOpen(false);
      return;
    }

    if (onPaymentFlow) {
      pausedRef.current = true;
      setOpen(false);
      return;
    }

    // Resuming after a pause: brief grace period before the next prompt.
    if (pausedRef.current) {
      pausedRef.current = false;
      nextAtRef.current = Date.now() + 8_000;
    }

    const tick = () => {
      if (pausedRef.current) return;
      if (hasUpgradeIntent()) return;
      if (Date.now() >= nextAtRef.current) setOpen(true);
    };
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [loading, user, profile, onPaymentFlow]);

  const dismiss = () => {
    setOpen(false);
    nextAtRef.current = Date.now() + SNOOZE_MS;
  };

  const goUpgrade = () => {
    setOpen(false);
    pausedRef.current = true;
    setUpgradeIntent(true);
    navigate("/upgrade");
  };

  // "Cancel" inside the modal explicitly clears the upgrade intent so the
  // nag will resume on its normal cadence again.
  const cancelUpgrade = () => {
    setUpgradeIntent(false);
    dismiss();
  };

  if (!user || !profile || (profile.level ?? 0) > 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="glass-card border-primary/30 max-w-md p-0 overflow-hidden">
        <div className="relative h-32 bg-gradient-emerald flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 mesh-bg opacity-60" />
          <div className="relative h-16 w-16 rounded-full bg-background/20 backdrop-blur-md grid place-items-center animate-pulse-ring">
            <Crown className="h-8 w-8 text-primary-foreground" />
          </div>
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 h-7 w-7 rounded-full bg-background/30 hover:bg-background/50 grid place-items-center text-primary-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 pt-4">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-center">
              Unlock your earning potential
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              You're on the <span className="font-semibold text-foreground">Starter</span> tier. Upgrade to unlock
              Watch & Earn, Spin & Win, higher daily caps and faster withdrawals.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Silver", price: "$25" },
              { label: "Gold", price: "$50" },
              { label: "Platinum", price: "$100" },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="text-xs font-medium text-primary">{t.label}</div>
                <div className="font-display text-lg font-semibold mt-1">{t.price}</div>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-6 flex-col sm:flex-col gap-2">
            <Button variant="hero" size="lg" className="w-full" onClick={goUpgrade}>
              <Sparkles className="h-4 w-4" /> Upgrade now
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={cancelUpgrade}>
              Not now (remind me in 1 minute)
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
