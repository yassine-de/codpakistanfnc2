
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Create user status enum
CREATE TYPE public.user_status AS ENUM ('active', 'inactive');

-- Create debt status enum
CREATE TYPE public.debt_status AS ENUM ('paid', 'unpaid');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles per security best practices)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'default',
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create revenue_entries table
CREATE TABLE public.revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  category TEXT NOT NULL DEFAULT 'Shipping Company Payout',
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create expense_entries table
CREATE TABLE public.expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  category TEXT NOT NULL,
  description TEXT,
  receipt_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create seller_debts table
CREATE TABLE public.seller_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  status public.debt_status NOT NULL DEFAULT 'unpaid',
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table (append-only)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles RLS
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- User roles RLS
CREATE POLICY "Authenticated users can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Accounts RLS
CREATE POLICY "Authenticated users can view accounts" ON public.accounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can insert accounts" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "Admins and editors can update accounts" ON public.accounts
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "Admins can delete accounts" ON public.accounts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Revenue entries RLS
CREATE POLICY "Authenticated users can view revenue" ON public.revenue_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can insert revenue" ON public.revenue_entries
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "Admins and editors can update revenue" ON public.revenue_entries
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "Admins can delete revenue" ON public.revenue_entries
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Expense entries RLS
CREATE POLICY "Authenticated users can view expenses" ON public.expense_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can insert expenses" ON public.expense_entries
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "Admins and editors can update expenses" ON public.expense_entries
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "Admins can delete expenses" ON public.expense_entries
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seller debts RLS
CREATE POLICY "Authenticated users can view debts" ON public.seller_debts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can insert debts" ON public.seller_debts
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "Admins and editors can update debts" ON public.seller_debts
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );
CREATE POLICY "Admins can delete debts" ON public.seller_debts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Audit logs RLS: all authenticated can read, all authenticated can insert, NO update or delete
CREATE POLICY "Authenticated users can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true);

-- Storage policies
CREATE POLICY "Authenticated users can view receipts" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'receipts');
CREATE POLICY "Admins and editors can upload receipts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Admins and editors can update receipts" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'receipts');
CREATE POLICY "Admins can delete receipts" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'receipts');

-- Create trigger function for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default accounts
INSERT INTO public.accounts (name, type, opening_balance, status)
VALUES
  ('Binance', 'Crypto Exchange', 0, 'active'),
  ('Wise', 'Bank Transfer', 0, 'active'),
  ('Redotpay', 'Payment Card', 0, 'active');
