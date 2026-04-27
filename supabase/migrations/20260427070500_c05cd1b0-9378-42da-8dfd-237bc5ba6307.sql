
-- Roles enum and user_roles table (avoid privilege escalation)
CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_seller BOOLEAN NOT NULL DEFAULT false,
  seller_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE TABLE public.seller_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  contact TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cards (products) listed by sellers / admin
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bin TEXT NOT NULL,
  brand TEXT NOT NULL, -- VISA, MASTERCARD, AMEX, DISCOVER
  country TEXT NOT NULL, -- ISO code: US, CA, GB...
  state TEXT,
  city TEXT,
  zip TEXT,
  exp_month TEXT,
  exp_year TEXT,
  refundable BOOLEAN NOT NULL DEFAULT false,
  has_phone BOOLEAN NOT NULL DEFAULT false,
  has_email BOOLEAN NOT NULL DEFAULT false,
  base TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'available', -- available, in_cart, sold
  reserved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cards_status_idx ON public.cards(status);
CREATE INDEX cards_brand_idx ON public.cards(brand);
CREATE INDEX cards_country_idx ON public.cards(country);

CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_id)
);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  card_snapshot JSONB NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  kind TEXT NOT NULL, -- recharge, purchase, seller_payout
  method TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.news_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security definer role check (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_updates ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles viewable by self or admin" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Admin update any profile" ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

-- user_roles: only admin can manage; users can read their own
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seller applications
CREATE POLICY "Users insert own application" ON public.seller_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "View own application or admin" ON public.seller_applications FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin update applications" ON public.seller_applications FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

-- Cards: anyone authenticated can view available; sellers manage own; admin manages all
CREATE POLICY "View available cards" ON public.cards FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Seller insert own cards" ON public.cards FOR INSERT
  WITH CHECK (auth.uid() = seller_id AND (public.has_role(auth.uid(),'seller') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Seller update own cards" ON public.cards FOR UPDATE
  USING (auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Seller delete own cards" ON public.cards FOR DELETE
  USING (auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'));

-- Cart items
CREATE POLICY "Manage own cart" ON public.cart_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Orders
CREATE POLICY "View own orders" ON public.orders FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Create own orders" ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Order items: viewable through parent order
CREATE POLICY "View own order items" ON public.order_items FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Insert own order items" ON public.order_items FOR INSERT
  WITH CHECK (EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- Transactions
CREATE POLICY "View own transactions" ON public.transactions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Insert own transactions" ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Tickets
CREATE POLICY "View own tickets" ON public.tickets FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Create own tickets" ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reply tickets" ON public.tickets FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

-- Announcements + news
CREATE POLICY "Anyone view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admin manage announcements" ON public.announcements FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone view news" ON public.news_updates FOR SELECT USING (true);
CREATE POLICY "Admin manage news" ON public.news_updates FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
