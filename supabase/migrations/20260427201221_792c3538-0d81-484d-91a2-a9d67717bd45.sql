
-- Restore column grants
GRANT SELECT ON public.cards TO authenticated;

-- Remove broad SELECT policy; only sellers/admins/buyers see rows directly now
DROP POLICY IF EXISTS "Browse available cards" ON public.cards;

-- Browse function (returns safe metadata only)
CREATE OR REPLACE FUNCTION public.list_available_cards()
RETURNS TABLE (
  id uuid,
  seller_id uuid,
  brand text,
  bin text,
  country text,
  state text,
  city text,
  zip text,
  base text,
  price numeric,
  status text,
  has_email boolean,
  has_phone boolean,
  refundable boolean,
  exp_month text,
  exp_year text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.seller_id, c.brand, c.bin, c.country, c.state, c.city, c.zip,
         c.base, c.price, c.status, c.has_email, c.has_phone, c.refundable,
         c.exp_month, c.exp_year, c.created_at
  FROM public.cards c
  WHERE c.status = 'available';
$$;

REVOKE ALL ON FUNCTION public.list_available_cards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_available_cards() TO authenticated;

-- Replace view to read from the safe function (so it never exposes sensitive cols)
DROP VIEW IF EXISTS public.cards_public;
CREATE VIEW public.cards_public
WITH (security_invoker = true)
AS
SELECT * FROM public.list_available_cards();

GRANT SELECT ON public.cards_public TO authenticated;
