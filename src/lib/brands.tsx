import { ReactNode } from "react";

export const BRANDS = ["VISA", "MASTERCARD", "AMEX", "DISCOVER", "JCB", "DINERS"] as const;
export type Brand = (typeof BRANDS)[number];

export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
];

export const countryFlag = (code?: string | null) =>
  COUNTRIES.find((c) => c.code === code?.toUpperCase())?.flag ?? "🌐";

/** Auto-detect card brand from BIN/card number */
export function detectBrandFromBin(bin: string): string {
  const n = (bin ?? "").replace(/\D/g, "");
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "MASTERCARD";
  if (/^3[47]/.test(n)) return "AMEX";
  if (/^6(011|5|4[4-9])/.test(n)) return "DISCOVER";
  if (/^35/.test(n)) return "JCB";
  if (/^3(0[0-5]|[68])/.test(n)) return "DINERS";
  return "OTHER";
}

/** Brand emoji for display */
export function brandEmoji(brand: string): string {
  switch (brand?.toUpperCase()) {
    case "VISA": return "💳";
    case "MASTERCARD": return "🔴";
    case "AMEX": return "💎";
    case "DISCOVER": return "🔶";
    case "JCB": return "🟢";
    case "DINERS": return "🏛️";
    default: return "💳";
  }
}

/** Role badge with emoji */
export const RoleBadge = ({ role, isVerified }: { role: string; isVerified?: boolean }): ReactNode => {
  switch (role?.toLowerCase()) {
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-display font-bold uppercase tracking-wider">
          🛡️ Admin
        </span>
      );
    case "seller":
      return (
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-display font-bold uppercase tracking-wider ${
          isVerified
            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
            : "bg-amber-500/20 border border-amber-500/40 text-amber-400"
        }`}>
          {isVerified ? "✅ Verified" : "⏳ Unverified"}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary-glow font-display font-bold uppercase tracking-wider">
          🏷️ Buyer
        </span>
      );
  }
};

export const BrandLogo = ({ brand, className = "h-6" }: { brand: string; className?: string }): ReactNode => {
  const b = brand?.toUpperCase();
  switch (b) {
    case "VISA":
      return (
        <span className={`inline-flex items-center justify-center font-display font-black tracking-tight rounded-md px-2 py-0.5 bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-lg text-[10px] ${className}`}>
          💳 VISA
        </span>
      );
    case "MASTERCARD":
      return (
        <span className={`inline-flex items-center gap-0.5 ${className}`}>
          <span className="h-5 w-5 rounded-full bg-red-500 shadow-[0_0_12px_hsl(0_84%_60%/0.6)]" />
          <span className="h-5 w-5 -ml-2 rounded-full bg-amber-400 shadow-[0_0_12px_hsl(45_100%_50%/0.6)] mix-blend-screen" />
        </span>
      );
    case "AMEX":
      return (
        <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-sky-400 to-sky-700 text-white shadow-lg text-[10px] ${className}`}>
          💎 AMEX
        </span>
      );
    case "DISCOVER":
      return (
        <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-orange-400 to-orange-700 text-white shadow-lg text-[10px] ${className}`}>
          🔶 DISC
        </span>
      );
    case "JCB":
      return (
        <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-lg text-[10px] ${className}`}>
          🟢 JCB
        </span>
      );
    case "DINERS":
      return (
        <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-slate-400 to-slate-700 text-white shadow-lg text-[10px] ${className}`}>
          🏛️ DIN
        </span>
      );
    default:
      return <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-zinc-500 to-zinc-700 text-white shadow-lg text-[10px] ${className}`}>💳 {brand || "?"}</span>;
  }
};

/** Premium catalog card icon - larger visual for homepage */
export const CatalogBrandIcon = ({ brand }: { brand: string }): ReactNode => {
  const b = brand?.toUpperCase();
  switch (b) {
    case "VISA":
      return (
        <div className="flex items-center gap-2">
          <span className="text-2xl">💳</span>
          <span className="font-display text-2xl font-bold text-white tracking-tight">VISA</span>
        </div>
      );
    case "MASTERCARD":
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <span className="h-7 w-7 rounded-full bg-red-500 shadow-[0_0_16px_hsl(0_84%_60%/0.7)]" />
            <span className="h-7 w-7 -ml-3 rounded-full bg-amber-400 shadow-[0_0_16px_hsl(45_100%_50%/0.7)] mix-blend-screen" />
          </div>
          <span className="font-display text-2xl font-bold text-white tracking-tight ml-1">Mastercard</span>
        </div>
      );
    case "AMEX":
      return (
        <div className="flex items-center gap-2">
          <span className="text-2xl">💎</span>
          <span className="font-display text-2xl font-bold text-white tracking-tight">Amex</span>
        </div>
      );
    case "DISCOVER":
      return (
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔶</span>
          <span className="font-display text-2xl font-bold text-white tracking-tight">Discover</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-2">
          <span className="text-2xl">💳</span>
          <span className="font-display text-2xl font-bold text-white tracking-tight">{brand}</span>
        </div>
      );
  }
};
