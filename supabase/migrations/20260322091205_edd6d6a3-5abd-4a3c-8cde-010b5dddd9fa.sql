ALTER TABLE public.expense_entries ADD COLUMN ad_platform text DEFAULT NULL;
ALTER TABLE public.revenue_entries ADD COLUMN notes text DEFAULT NULL;
ALTER TABLE public.expense_entries ADD COLUMN notes text DEFAULT NULL;