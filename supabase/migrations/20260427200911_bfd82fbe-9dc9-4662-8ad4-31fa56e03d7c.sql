
-- 1) CARDS
DROP POLICY IF EXISTS "Browse available cards metadata" ON public.cards;
DROP POLICY IF EXISTS "Browse available cards via safe view" ON public.cards;

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

-- Allow narrow SELECT on cards (column grants enforce the column restriction)
CREATE POLICY "Browse available cards safe columns"
ON public.cards
FOR SELECT
TO authenticated
USING (status = 'available');

REVOKE SELECT (cc_number, cvv, holder_name, email, phone, address) ON public.cards FROM authenticated;
REVOKE SELECT (cc_number, cvv, holder_name, email, phone, address) ON public.cards FROM anon;

GRANT SELECT (
  id, seller_id, brand, bin, country, state, city, zip, base,
  price, status, has_email, has_phone, refundable,
  exp_month, exp_year, created_at, reserved_at, reserved_by
) ON public.cards TO authenticated;

-- 2) PROFILES guard trigger
DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 3) ORDERS admin policies
DROP POLICY IF EXISTS "Admin update orders" ON public.orders;
DROP POLICY IF EXISTS "Admin delete orders" ON public.orders;

CREATE POLICY "Admin update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
