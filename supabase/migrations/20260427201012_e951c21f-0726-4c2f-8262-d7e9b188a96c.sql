
-- Restore full column SELECT grants; row-level policies enforce who sees which rows.
GRANT SELECT ON public.cards TO authenticated;

-- Remove the broad "available" row policy so signed-in users can't read sensitive
-- columns from the base table for cards they neither own nor purchased.
DROP POLICY IF EXISTS "Browse available cards safe columns" ON public.cards;

-- Browsing now must go through public.cards_public (security_invoker view that
-- projects only safe metadata columns and is granted to authenticated/anon).
-- The view runs with the caller's RLS, so we add a minimal SELECT policy that
-- ONLY matches when accessed through the view by checking nothing extra is
-- needed: the view itself limits columns. To allow the view to return rows,
-- we need a SELECT policy on the base table for available rows. Keep it but
-- the safety comes from the column grants on the view, not the base table.
-- However, we cannot distinguish view-vs-direct access in RLS, so we instead
-- rely on a SECURITY DEFINER function approach: redefine the view as SECURITY
-- DEFINER-equivalent by using a function owner with limited grants.

-- Simpler robust approach: make the view run as a definer (owner = postgres)
-- by setting security_invoker = false, and revoke direct table SELECT for
-- non-owners/non-buyers/non-admins (already the case after dropping the
-- broad policy).
ALTER VIEW public.cards_public SET (security_invoker = false);
