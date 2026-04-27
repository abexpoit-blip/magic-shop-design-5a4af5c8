import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  shop_name: string;
  shop_tag: string;
  hero_eyebrow: string;
  hero_title: string;
  hero_sub: string;
  hero_cta: string;
  ticker_items: string[];
  default_commission_percent: number;
  min_card_price: number;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  shop_name: "cruzercc.shop",
  shop_tag: "GIFT CARD · CC PROVIDER",
  hero_eyebrow: "WELCOME BACK",
  hero_title: "The world's most trusted Gift Card & CC marketplace.",
  hero_sub:
    "Verified inventory from elite sellers, instant delivery, automated replacement, and vault-grade settlement.",
  hero_cta: "Enter the marketplace",
  ticker_items: [
    "● LIVE INVENTORY · 12,400+ FRESH CARDS",
    "★ VERIFIED SELLERS · INSTANT DELIVERY",
    "● 99.4% VALID RATE THIS WEEK",
    "↗ AUTO REPLACEMENT WITHIN 5 MINUTES",
    "● SUPPORT 24/7 · @CRUZERCC_SUPPORT",
  ],
  default_commission_percent: 20,
  min_card_price: 1,
};

let cache: SiteSettings | null = null;
const listeners = new Set<(s: SiteSettings) => void>();

const broadcast = (s: SiteSettings) => {
  cache = s;
  listeners.forEach((l) => l(s));
};

export const refreshSiteSettings = async (): Promise<SiteSettings> => {
  const { data } = await supabase
    .from("site_settings" as never)
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const row = (data ?? null) as Partial<SiteSettings> | null;
  const merged: SiteSettings = {
    ...DEFAULT_SETTINGS,
    ...(row ?? {}),
    ticker_items: Array.isArray(row?.ticker_items)
      ? (row!.ticker_items as string[])
      : DEFAULT_SETTINGS.ticker_items,
  };
  broadcast(merged);
  return merged;
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cache ?? DEFAULT_SETTINGS);
  useEffect(() => {
    listeners.add(setSettings);
    if (!cache) void refreshSiteSettings();
    return () => {
      listeners.delete(setSettings);
    };
  }, []);
  return settings;
}
