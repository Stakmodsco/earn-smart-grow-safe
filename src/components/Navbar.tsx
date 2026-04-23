import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Coins, LogOut, Shield } from "lucide-react";

export const Navbar = () => {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-emerald grid place-items-center shadow-emerald">
            <Coins className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">Monetra</span>
        </Link>
        <nav className="flex items-center gap-2">
          {pathname === "/" && (
            <>
              <a href="#how" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground px-3">How it works</a>
              <a href="#tiers" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground px-3">Tiers</a>
              <a href="#faq" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground px-3">FAQ</a>
            </>
          )}
          {user ? (
            <>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                  <Shield className="h-4 w-4 mr-1" /> Admin
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
              <Button variant="ghost" size="sm" onClick={onLogout}>
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
