import logoUrl from "@/assets/monetra-logo.png";
import { cn } from "@/lib/utils";

interface MonetraLogoProps {
  className?: string;
  size?: number;
  withWordmark?: boolean;
}

/**
 * MonetraLogo — renders the brand mark in an "icon style" rounded glossy
 * container. The actual artwork lives in src/assets/monetra-logo.png so it
 * stays high-resolution without bloating the JS bundle.
 */
export const MonetraLogo = ({ className, size = 36, withWordmark = false }: MonetraLogoProps) => {
  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <div
        style={{ width: size, height: size }}
        className={cn(
          "rounded-2xl overflow-hidden relative shrink-0",
          "ring-1 ring-primary/40",
          "shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.55),inset_0_1px_0_hsl(0_0%_100%/0.35)]",
          "bg-gradient-to-br from-[#0d0d28] to-[#1a1a3e]",
          "transition-transform duration-300 group-hover:scale-105",
        )}
      >
        <img
          src={logoUrl}
          alt="Monetra logo"
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* subtle gloss */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent"
        />
      </div>
      {withWordmark && (
        <span className="font-display text-xl font-semibold tracking-tight">Monetra</span>
      )}
    </div>
  );
};
