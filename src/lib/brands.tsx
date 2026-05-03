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

export const BrandLogo = ({ brand, className = "h-6" }: { brand: string; className?: string }): ReactNode => {
  const b = brand?.toUpperCase();
  switch (b) {
    case "VISA":
      return (
        <span className={`inline-flex items-center justify-center font-display font-black tracking-tight rounded-md px-2 py-0.5 bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-lg text-[10px] ${className}`}>
          VISA
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
          AMEX
        </span>
      );
    case "DISCOVER":
      return (
        <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-orange-400 to-orange-700 text-white shadow-lg text-[10px] ${className}`}>
          DISC
        </span>
      );
    case "JCB":
      return (
        <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-lg text-[10px] ${className}`}>
          JCB
        </span>
      );
    case "DINERS":
      return (
        <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-slate-400 to-slate-700 text-white shadow-lg text-[10px] ${className}`}>
          DIN
        </span>
      );
    default:
      return <span className={`inline-flex items-center justify-center font-display font-bold rounded-md px-2 py-0.5 bg-gradient-to-br from-zinc-500 to-zinc-700 text-white shadow-lg text-[10px] ${className}`}>{brand || "?"}</span>;
  }
};
