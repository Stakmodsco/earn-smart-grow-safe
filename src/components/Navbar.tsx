import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MonetraLogo } from "@/components/MonetraLogo";

export const Navbar = () => {
  const { user } = useAuth();
  // We intentionally read isAdmin only to KEEP the hook order stable across
  // renders. The admin link is **never** shown here — admin access happens
  // exclusively through the dedicated /admin route, which performs its own
  // server-side admin check. This guarantees non-admins can never see any
  // admin nav entry / icon, even on hover or in the mobile menu.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isAdmin = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <MonetraLogo size={36} />
          <span className="font-display text-xl font-semibold tracking-tight">Monetra</span>
        </Link>
        <nav className="flex items-center gap-2">
          {pathname === "/" && (
            <>
              <a href="#how" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground px-3 transition-colors">How it works</a>
              <a href="#tiers" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground px-3 transition-colors">Tiers</a>
              <a href="#faq" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground px-3 transition-colors">FAQ</a>
            </>
          )}
          <ThemeToggle />
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
              <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Sign in</Button>
              <Button variant="hero" size="sm" onClick={() => navigate("/auth?mode=signup")}>Get started</Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
