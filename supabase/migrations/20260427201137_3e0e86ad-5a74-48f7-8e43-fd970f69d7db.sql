
-- Drop the definer browse function (replaced by view + column grants)
DROP FUNCTION IF EXISTS public.list_available_cards();

-- Recreate the view as security_invoker (standard, no warnings)
DROP VIEW IF EXISTS public.cards_public;
CREATE VIEW public.cards_public
WITH (security_invoker = true)
AS
SELECT
  id, seller_id, brand, bin, country, state, city, zip, base,
  price, status, has_email, has_phone, refundable,
  exp_month, exp_year, created_at
FROM public.cards
WHERE status = 'available';

GRANT SELECT ON public.cards_public TO authenticated, anon;

-- Re-add the row policy so the view (and direct queries) can return available rows
CREATE POLICY "Browse available cards"
ON public.cards
FOR SELECT
TO authenticated
USING (status = 'available');

-- Revoke sensitive column access from authenticated and anon
REVOKE SELECT (cc_number, cvv, holder_name, email, phone, address) ON public.cards FROM authenticated;
REVOKE SELECT (cc_number, cvv, holder_name, email, phone, address) ON public.cards FROM anon;

-- Provide a SECURITY DEFINER function so buyers can fetch the full sensitive
-- data ONLY for cards they have actually purchased.
CREATE OR REPLACE FUNCTION public.get_purchased_card_full(_card_ids uuid[])
RETURNS TABLE (
  id uuid,
  bin text,
  brand text,
  country text,
  price numeric,
  base text,
  exp_month text,
  exp_year text,
  cc_number text,
  cvv text,
  holder_name text,
  email text,
  phone text,
  address text,
  state text,
  city text,
  zip text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.bin, c.brand, c.country, c.price, c.base,
         c.exp_month, c.exp_year, c.cc_number, c.cvv, c.holder_name,
         c.email, c.phone, c.address, c.state, c.city, c.zip
  FROM public.cards c
  WHERE c.id = ANY(_card_ids)
    AND (
      EXISTS (
        SELECT 1
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.user_id = auth.uid()
          AND ((oi.card_snapshot->>'id')::uuid = c.id)
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR c.seller_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.get_purchased_card_full(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_purchased_card_full(uuid[]) TO authenticated;
