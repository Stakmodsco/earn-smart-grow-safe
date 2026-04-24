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

export const UpgradeNagModal = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const nextAtRef = useRef<number>(Date.now() + NAG_INTERVAL_MS);
  const pausedRef = useRef(false);

  // Pause the nag while the user is on the payment / upgrade flow,
  // resume (and reset the timer) the moment they leave without completing.
  const onPaymentFlow = pathname.startsWith("/payment") || pathname === "/upgrade";

  useEffect(() => {
    if (loading || !user || !profile) return;
    if ((profile.level ?? 0) > 0) return; // already upgraded
    if (profile.flagged) return;

    if (onPaymentFlow) {
      pausedRef.current = true;
      setOpen(false);
      return;
    }

    // Resuming: if we were paused, give the user a brief grace before nagging again.
    if (pausedRef.current) {
      pausedRef.current = false;
      nextAtRef.current = Date.now() + 8_000;
    }

    const tick = () => {
      if (pausedRef.current) return;
      if (Date.now() >= nextAtRef.current) {
        setOpen(true);
      }
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
    navigate("/upgrade");
  };

  if (!user || !profile || (profile.level ?? 0) > 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="glass-card border-primary/30 max-w-md p-0 overflow-hidden">
        {/* Decorative gradient header */}
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
              { label: "Bronze", price: "$25", color: "text-amber-600 dark:text-amber-400" },
              { label: "Silver", price: "$50", color: "text-primary" },
              { label: "Gold", price: "$100", color: "text-yellow-600 dark:text-yellow-400" },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className={`text-xs font-medium ${t.color}`}>{t.label}</div>
                <div className="font-display text-lg font-semibold mt-1">{t.price}</div>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-6 flex-col sm:flex-col gap-2">
            <Button variant="hero" size="lg" className="w-full" onClick={goUpgrade}>
              <Sparkles className="h-4 w-4" /> Upgrade now
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={dismiss}>
              Not now (remind me in 1 minute)
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
