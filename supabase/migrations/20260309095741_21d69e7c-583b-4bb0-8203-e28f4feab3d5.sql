
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- ACCOUNTS
DROP POLICY IF EXISTS "Authenticated users can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins and editors can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins and editors can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can delete accounts" ON public.accounts;

CREATE POLICY "Authenticated users can view accounts" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Admins and editors can update accounts" ON public.accounts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Admins can delete accounts" ON public.accounts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- AUDIT_LOGS
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- EXPENSE_ENTRIES
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expense_entries;
DROP POLICY IF EXISTS "Admins and editors can insert expenses" ON public.expense_entries;
DROP POLICY IF EXISTS "Admins and editors can update expenses" ON public.expense_entries;
DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expense_entries;

CREATE POLICY "Authenticated users can view expenses" ON public.expense_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can insert expenses" ON public.expense_entries FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Admins and editors can update expenses" ON public.expense_entries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Admins can delete expenses" ON public.expense_entries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- PROFILES
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- REVENUE_ENTRIES
DROP POLICY IF EXISTS "Authenticated users can view revenue" ON public.revenue_entries;
DROP POLICY IF EXISTS "Admins and editors can insert revenue" ON public.revenue_entries;
DROP POLICY IF EXISTS "Admins and editors can update revenue" ON public.revenue_entries;
DROP POLICY IF EXISTS "Admins can delete revenue" ON public.revenue_entries;

CREATE POLICY "Authenticated users can view revenue" ON public.revenue_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can insert revenue" ON public.revenue_entries FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Admins and editors can update revenue" ON public.revenue_entries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Admins can delete revenue" ON public.revenue_entries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- SELLER_DEBTS
DROP POLICY IF EXISTS "Authenticated users can view debts" ON public.seller_debts;
DROP POLICY IF EXISTS "Admins and editors can insert debts" ON public.seller_debts;
DROP POLICY IF EXISTS "Admins and editors can update debts" ON public.seller_debts;
DROP POLICY IF EXISTS "Admins can delete debts" ON public.seller_debts;

CREATE POLICY "Authenticated users can view debts" ON public.seller_debts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and editors can insert debts" ON public.seller_debts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Admins and editors can update debts" ON public.seller_debts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Admins can delete debts" ON public.seller_debts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- USER_ROLES
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Also create the missing trigger for auto-creating profiles
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
