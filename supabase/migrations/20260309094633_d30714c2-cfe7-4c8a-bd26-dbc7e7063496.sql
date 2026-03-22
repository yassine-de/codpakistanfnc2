
-- Fix RLS policies: change from RESTRICTIVE to PERMISSIVE

-- PROFILES
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR auth.uid() = id);
CREATE POLICY "Authenticated users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ACCOUNTS
DROP POLICY IF EXISTS "Admins and editors can insert accounts" ON accounts;
DROP POLICY IF EXISTS "Admins and editors can update accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can delete accounts" ON accounts;
DROP POLICY IF EXISTS "Authenticated users can view accounts" ON accounts;

CREATE POLICY "Admins and editors can insert accounts" ON accounts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins and editors can update accounts" ON accounts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins can delete accounts" ON accounts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view accounts" ON accounts FOR SELECT TO authenticated USING (true);

-- REVENUE_ENTRIES
DROP POLICY IF EXISTS "Admins and editors can insert revenue" ON revenue_entries;
DROP POLICY IF EXISTS "Admins and editors can update revenue" ON revenue_entries;
DROP POLICY IF EXISTS "Admins can delete revenue" ON revenue_entries;
DROP POLICY IF EXISTS "Authenticated users can view revenue" ON revenue_entries;

CREATE POLICY "Admins and editors can insert revenue" ON revenue_entries FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins and editors can update revenue" ON revenue_entries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins can delete revenue" ON revenue_entries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view revenue" ON revenue_entries FOR SELECT TO authenticated USING (true);

-- EXPENSE_ENTRIES
DROP POLICY IF EXISTS "Admins and editors can insert expenses" ON expense_entries;
DROP POLICY IF EXISTS "Admins and editors can update expenses" ON expense_entries;
DROP POLICY IF EXISTS "Admins can delete expenses" ON expense_entries;
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expense_entries;

CREATE POLICY "Admins and editors can insert expenses" ON expense_entries FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins and editors can update expenses" ON expense_entries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins can delete expenses" ON expense_entries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view expenses" ON expense_entries FOR SELECT TO authenticated USING (true);

-- SELLER_DEBTS
DROP POLICY IF EXISTS "Admins and editors can insert debts" ON seller_debts;
DROP POLICY IF EXISTS "Admins and editors can update debts" ON seller_debts;
DROP POLICY IF EXISTS "Admins can delete debts" ON seller_debts;
DROP POLICY IF EXISTS "Authenticated users can view debts" ON seller_debts;

CREATE POLICY "Admins and editors can insert debts" ON seller_debts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins and editors can update debts" ON seller_debts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins can delete debts" ON seller_debts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view debts" ON seller_debts FOR SELECT TO authenticated USING (true);

-- USER_ROLES
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON user_roles;

CREATE POLICY "Admins can delete roles" ON user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view roles" ON user_roles FOR SELECT TO authenticated USING (true);

-- AUDIT_LOGS
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;

CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view audit logs" ON audit_logs FOR SELECT TO authenticated USING (true);
