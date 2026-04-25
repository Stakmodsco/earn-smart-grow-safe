import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "warning" | "success" | "muted" | "danger";
type Size = "sm" | "md" | "lg";

interface GlossyTileProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  variant?: Variant;
  size?: Size;
  locked?: boolean;
}

const SIZE_MAP: Record<Size, { box: string; icon: string; radius: string }> = {
  sm: { box: "h-9 w-9", icon: "h-4 w-4", radius: "rounded-lg" },
  md: { box: "h-12 w-12", icon: "h-5 w-5", radius: "rounded-xl" },
  lg: { box: "h-16 w-16", icon: "h-7 w-7", radius: "rounded-2xl" },
};

// Variant colours are driven by CSS tokens from index.css so light/dark themes
// just work. These map to the Monetra indigo/violet palette.
const VARIANT_MAP: Record<Variant, { bg: string; ring: string; iconCls: string }> = {
  primary: {
    bg: "from-primary/95 via-primary/80 to-primary-glow/70",
    ring: "ring-primary/40",
    iconCls: "text-primary-foreground",
  },
  warning: {
    bg: "from-warning/95 via-warning/80 to-warning/60",
    ring: "ring-warning/40",
    iconCls: "text-warning-foreground",
  },
  success: {
    bg: "from-success/95 via-success/80 to-success/60",
    ring: "ring-success/40",
    iconCls: "text-primary-foreground",
  },
  muted: {
    bg: "from-muted via-muted/80 to-muted/60",
    ring: "ring-border",
    iconCls: "text-muted-foreground",
  },
  danger: {
    bg: "from-destructive/95 via-destructive/80 to-destructive/60",
    ring: "ring-destructive/40",
    iconCls: "text-destructive-foreground",
  },
};

/**
 * GlossyTile — a reusable "premium 3D" icon tile inspired by the Zerion
 * design language. It uses a layered gradient + inner highlight + soft
 * outer shadow purely with CSS so it themes correctly in light/dark mode
 * and never ships an extra image asset.
 */
export const GlossyTile = React.forwardRef<HTMLDivElement, GlossyTileProps>(
  ({ icon: Icon, variant = "primary", size = "md", locked = false, className, ...rest }, ref) => {
    const s = SIZE_MAP[size];
    const v = VARIANT_MAP[locked ? "muted" : variant];
    return (
      <div
        ref={ref}
        className={cn(
          "relative grid place-items-center shrink-0 select-none",
          s.box,
          s.radius,
          "bg-gradient-to-br",
          v.bg,
          "ring-1",
          v.ring,
          "shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.45),inset_0_1px_0_hsl(0_0%_100%/0.35),inset_0_-2px_4px_hsl(0_0%_0%/0.18)]",
          "transition-transform duration-300 ease-out",
          locked && "opacity-60 grayscale",
          className,
        )}
        {...rest}
      >
        {/* glossy top highlight */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-1 top-1 h-1/3",
            s.radius,
            "bg-gradient-to-b from-white/40 via-white/10 to-transparent",
          )}
        />
        <Icon className={cn(s.icon, v.iconCls, "relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]")} />
      </div>
    );
  },
);
GlossyTile.displayName = "GlossyTile";
