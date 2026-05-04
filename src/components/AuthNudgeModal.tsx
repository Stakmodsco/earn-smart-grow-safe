import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, LogIn, UserPlus } from "lucide-react";

// Re-prompt unauthenticated visitors to sign up (or sign in if they've been
// here before). Pops up shortly after page load, then again every few minutes
// until they either authenticate or dismiss permanently for the session.
const FIRST_DELAY_MS = 8_000;
const REPEAT_DELAY_MS = 60_000;
const HAS_ACCOUNT_KEY = "cheddar4u:has-account";
const SESSION_DISMISSED_KEY = "cheddar4u:nudge-dismissed";

const PUBLIC_ROUTES = new Set(["/", "/auth"]);

export const AuthNudgeModal = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    try { setHasAccount(localStorage.getItem(HAS_ACCOUNT_KEY) === "1"); } catch { /* ignore */ }
  }, []);

  // If a user is signed in, remember they have an account so future visits
  // (after sign-out) prompt sign-in instead of sign-up.
  useEffect(() => {
    if (user) {
      try { localStorage.setItem(HAS_ACCOUNT_KEY, "1"); } catch { /* ignore */ }
      setHasAccount(true);
    }
  }, [user]);

  useEffect(() => {
    // Don't nag while auth state is resolving, on the auth page itself, or to signed-in users.
    if (loading || user) { setOpen(false); return; }
    if (location.pathname === "/auth") { setOpen(false); return; }
    if (!PUBLIC_ROUTES.has(location.pathname)) { setOpen(false); return; }
    if (sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1") return;

    const first = window.setTimeout(() => setOpen(true), FIRST_DELAY_MS);
    const interval = window.setInterval(() => {
      if (sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1") return;
      setOpen(true);
    }, REPEAT_DELAY_MS);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [loading, user, location.pathname]);

  const dismissForSession = () => {
    try { sessionStorage.setItem(SESSION_DISMISSED_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  if (user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center mb-3">
            {hasAccount ? <LogIn className="h-6 w-6 text-primary" /> : <Sparkles className="h-6 w-6 text-primary" />}
          </div>
          <DialogTitle className="font-display text-2xl">
            {hasAccount ? "Welcome back to Cheddar4u" : "Claim your $20 signup bonus"}
          </DialogTitle>
          <DialogDescription>
            {hasAccount
              ? "Sign in to continue earning, complete today's tasks, and check on your withdrawals."
              : "Create a free account in under a minute and we'll instantly credit a $20 welcome bonus to your locked balance."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={dismissForSession}>Maybe later</Button>
          {hasAccount ? (
            <>
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link to="/auth?mode=signup"><UserPlus className="h-4 w-4" /> Create new</Link>
              </Button>
              <Button asChild variant="hero" onClick={() => setOpen(false)}>
                <Link to="/auth"><LogIn className="h-4 w-4" /> Sign in</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link to="/auth"><LogIn className="h-4 w-4" /> I have an account</Link>
              </Button>
              <Button asChild variant="hero" onClick={() => setOpen(false)}>
                <Link to="/auth?mode=signup"><UserPlus className="h-4 w-4" /> Sign up free</Link>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
