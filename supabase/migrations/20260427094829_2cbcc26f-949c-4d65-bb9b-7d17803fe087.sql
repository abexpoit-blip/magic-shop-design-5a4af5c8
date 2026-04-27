-- Seller applications
CREATE TABLE IF NOT EXISTS public.seller_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram TEXT,
  jabber TEXT,
  expected_volume TEXT,
  sample_bins TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, status) DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own applications"
ON public.seller_applications FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users create own applications"
ON public.seller_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins update applications"
ON public.seller_applications FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Profile additions for seller program
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_seller_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_seller_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS seller_display_name TEXT,
  ADD COLUMN IF NOT EXISTS seller_bio TEXT;

-- Refund / replace requests
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'refund', -- refund, replace
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, replaced
  resolution_note TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyer/seller/admin see refunds"
ON public.refund_requests FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "buyers create refunds"
ON public.refund_requests FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "seller/admin resolve refunds"
ON public.refund_requests FOR UPDATE
USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

-- Price rules per seller
CREATE TABLE IF NOT EXISTS public.price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country TEXT,                  -- null = any
  brand TEXT,                    -- null = any
  refundable BOOLEAN,            -- null = any
  price NUMERIC(10,2) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller manages own price rules"
ON public.price_rules FOR ALL
USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS price_rules_seller_idx ON public.price_rules(seller_id);
CREATE INDEX IF NOT EXISTS refund_requests_seller_idx ON public.refund_requests(seller_id);
CREATE INDEX IF NOT EXISTS seller_applications_status_idx ON public.seller_applications(status);