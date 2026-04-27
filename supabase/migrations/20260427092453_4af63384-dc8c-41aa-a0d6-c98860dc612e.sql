
-- 1. Banned flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;

-- 2. Deposits (crypto recharge proofs)
CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL,
  txid text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own deposits or admin" ON public.deposits FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Create own deposit" ON public.deposits FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin update deposits" ON public.deposits FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Payouts (seller requests)
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL,
  address text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller view own payouts or admin" ON public.payouts FOR SELECT
  USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Seller create own payout" ON public.payouts FOR INSERT
  WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admin update payouts" ON public.payouts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Deposit addresses (admin-managed wallets shown on recharge)
CREATE TABLE IF NOT EXISTS public.deposit_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL UNIQUE,
  address text NOT NULL,
  network text,
  qr_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view addresses" ON public.deposit_addresses FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage addresses" ON public.deposit_addresses FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.deposit_addresses (method, address, network) VALUES
  ('USDT', 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'TRC20'),
  ('BTC',  'bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Bitcoin'),
  ('LTC',  'ltc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Litecoin')
ON CONFLICT (method) DO NOTHING;

-- 5. Allow admins to delete cards (for moderation)
DROP POLICY IF EXISTS "Admin delete any card" ON public.cards;
CREATE POLICY "Admin delete any card" ON public.cards FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Allow admins to insert cards (for direct admin upload)
DROP POLICY IF EXISTS "Admin insert cards" ON public.cards;
CREATE POLICY "Admin insert cards" ON public.cards FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
