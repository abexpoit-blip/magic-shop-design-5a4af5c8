ALTER TABLE public.site_settings
ADD COLUMN deposit_fee_percent numeric NOT NULL DEFAULT 0,
ADD COLUMN deposit_fee_flat numeric NOT NULL DEFAULT 0;