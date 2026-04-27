
-- Switch view back to security_invoker (standard, no warning) — keep it as a
-- convenience read-only safe projection. It only returns rows the caller's RLS
-- allows, so it will be empty for non-owners/non-buyers unless we add a row
-- policy. We'll instead expose browsing through a SECURITY DEFINER function.
ALTER VIEW public.cards_public SET (security_invoker = true);

-- Function returns only safe metadata for available cards; runs as definer
-- to bypass the absence of a broad SELECT policy on the base table.
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
  SELECT
    c.id, c.seller_id, c.brand, c.bin, c.country, c.state, c.city, c.zip,
    c.base, c.price, c.status, c.has_email, c.has_phone, c.refundable,
    c.exp_month, c.exp_year, c.created_at
  FROM public.cards c
  WHERE c.status = 'available';
$$;

REVOKE ALL ON FUNCTION public.list_available_cards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_available_cards() TO authenticated;
