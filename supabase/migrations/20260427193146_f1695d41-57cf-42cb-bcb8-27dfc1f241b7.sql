
DROP POLICY IF EXISTS "View available cards" ON public.cards;

CREATE POLICY "Buyer view purchased card"
ON public.cards FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.user_id = auth.uid()
      AND (oi.card_snapshot->>'id')::uuid = cards.id
  )
);

CREATE POLICY "Seller view own cards"
ON public.cards FOR SELECT TO authenticated
USING (auth.uid() = seller_id);

CREATE POLICY "Admin view all cards"
ON public.cards FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Browse available cards metadata"
ON public.cards FOR SELECT TO authenticated
USING (status = 'available');

REVOKE SELECT ON public.cards FROM authenticated;
REVOKE SELECT ON public.cards FROM anon;

GRANT SELECT (
  id, seller_id, brand, bin, country, state, city, zip,
  base, price, has_email, has_phone, refundable,
  exp_month, exp_year, status, created_at, reserved_at, reserved_by
) ON public.cards TO authenticated;

GRANT SELECT (
  cc_number, cvv, holder_name, email, phone, address
) ON public.cards TO authenticated;

CREATE OR REPLACE VIEW public.cards_public
WITH (security_invoker = true) AS
SELECT
  id, seller_id, brand, bin, country, state, city, zip,
  base, price, has_email, has_phone, refundable,
  exp_month, exp_year, status, created_at
FROM public.cards
WHERE status = 'available';

GRANT SELECT ON public.cards_public TO authenticated;

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile safe fields"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_seller IS DISTINCT FROM OLD.is_seller
     OR NEW.is_seller_verified IS DISTINCT FROM OLD.is_seller_verified
     OR NEW.is_seller_visible IS DISTINCT FROM OLD.is_seller_visible
     OR NEW.commission_percent IS DISTINCT FROM OLD.commission_percent
     OR NEW.trust_tier IS DISTINCT FROM OLD.trust_tier
     OR NEW.seller_status IS DISTINCT FROM OLD.seller_status
     OR NEW.banned IS DISTINCT FROM OLD.banned
     OR NEW.balance IS DISTINCT FROM OLD.balance
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

DROP POLICY IF EXISTS "Insert own transactions" ON public.transactions;
CREATE POLICY "Insert own transactions"
ON public.transactions FOR INSERT TO authenticated
WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "View own transactions" ON public.transactions;
CREATE POLICY "View own transactions"
ON public.transactions FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));
