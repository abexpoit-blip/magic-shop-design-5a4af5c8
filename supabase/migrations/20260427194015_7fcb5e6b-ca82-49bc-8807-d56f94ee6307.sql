
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shop_name TEXT NOT NULL DEFAULT 'cruzercc.shop',
  shop_tag  TEXT NOT NULL DEFAULT 'GIFT CARD · CC PROVIDER',
  hero_eyebrow TEXT NOT NULL DEFAULT 'WELCOME BACK',
  hero_title   TEXT NOT NULL DEFAULT 'The world''s most trusted Gift Card & CC marketplace.',
  hero_sub     TEXT NOT NULL DEFAULT 'Verified inventory from elite sellers, instant delivery, automated replacement, and vault-grade settlement.',
  hero_cta     TEXT NOT NULL DEFAULT 'Enter the marketplace',
  ticker_items JSONB NOT NULL DEFAULT '["LIVE INVENTORY","VERIFIED SELLERS","99.4% VALID RATE","AUTO REPLACEMENT","SUPPORT 24/7"]'::jsonb,
  default_commission_percent NUMERIC NOT NULL DEFAULT 20,
  min_card_price NUMERIC NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone view site settings" ON public.site_settings;
CREATE POLICY "Anyone view site settings" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin update site settings" ON public.site_settings;
CREATE POLICY "Admin update site settings" ON public.site_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin insert site settings" ON public.site_settings;
CREATE POLICY "Admin insert site settings" ON public.site_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
