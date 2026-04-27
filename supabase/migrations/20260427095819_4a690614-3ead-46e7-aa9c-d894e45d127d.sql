-- Allow anyone signed in to view profiles of visible sellers (for shop chips and public profiles)
CREATE POLICY "View visible sellers"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_seller_visible = true);