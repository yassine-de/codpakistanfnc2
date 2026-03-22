
-- Update DELETE policies to allow editors too

DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expense_entries;
CREATE POLICY "Admins and editors can delete expenses"
ON public.expense_entries FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

DROP POLICY IF EXISTS "Admins can delete revenue" ON public.revenue_entries;
CREATE POLICY "Admins and editors can delete revenue"
ON public.revenue_entries FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

DROP POLICY IF EXISTS "Admins can delete debts" ON public.seller_debts;
CREATE POLICY "Admins and editors can delete debts"
ON public.seller_debts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

DROP POLICY IF EXISTS "Admins can delete accounts" ON public.accounts;
CREATE POLICY "Admins and editors can delete accounts"
ON public.accounts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));
