import { BadgeCheck, Crown, Shield } from "lucide-react";

export type TrustTier = "none" | "verified" | "trusted" | "vip";

const tierMeta: Record<Exclude<TrustTier, "none">, { label: string; icon: typeof BadgeCheck; cls: string; ring: string }> = {
  verified: {
    label: "Verified",
    icon: BadgeCheck,
    cls: "text-primary-glow bg-primary/15 border-primary/40",
    ring: "shadow-[0_0_10px_hsl(var(--primary)/0.4)]",
  },
  trusted: {
    label: "Trusted",
    icon: Shield,
    cls: "text-emerald-300 bg-emerald-500/15 border-emerald-400/40",
    ring: "shadow-[0_0_10px_hsl(150_70%_50%/0.4)]",
  },
  vip: {
    label: "VIP",
    icon: Crown,
    cls: "text-gold bg-gold/15 border-gold/50",
    ring: "shadow-[0_0_12px_hsl(var(--gold)/0.5)]",
  },
};

export const TrustBadge = ({ tier, size = "sm" }: { tier?: TrustTier | null; size?: "xs" | "sm" | "md" }) => {
  if (!tier || tier === "none") return null;
  const meta = tierMeta[tier];
  const Icon = meta.icon;
  const dim =
    size === "xs" ? "text-[9px] px-1.5 py-0.5 gap-1" :
    size === "md" ? "text-xs px-2.5 py-1 gap-1.5" :
                    "text-[10px] px-2 py-0.5 gap-1";
  const ic = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <span className={`inline-flex items-center rounded-full border font-display uppercase tracking-wider ${meta.cls} ${meta.ring} ${dim}`}>
      <Icon className={ic} />
      {meta.label}
    </span>
  );
};

export const TRUST_TIERS: TrustTier[] = ["none", "verified", "trusted", "vip"];
