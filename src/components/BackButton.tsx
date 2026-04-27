import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  to?: string;
  label?: string;
  className?: string;
};

// Compact back-link used on inner pages so users can always return to their
// dashboard in one tap. Defaults to "/dashboard" but accepts any route.
export const BackButton = ({ to = "/dashboard", label = "Back to dashboard", className }: Props) => (
  <Button asChild variant="ghost" size="sm" className={cn("mb-4 -ml-2 h-8 px-2 text-muted-foreground hover:text-foreground", className)}>
    <Link to={to} aria-label={label}>
      <ArrowLeft className="h-4 w-4 mr-1.5" />
      {label}
    </Link>
  </Button>
);
