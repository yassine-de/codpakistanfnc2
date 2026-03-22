
-- Fix: Change created_by FK to point to profiles instead of auth.users
ALTER TABLE public.revenue_entries DROP CONSTRAINT revenue_entries_created_by_fkey;
ALTER TABLE public.revenue_entries ADD CONSTRAINT revenue_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE public.expense_entries DROP CONSTRAINT expense_entries_created_by_fkey;
ALTER TABLE public.expense_entries ADD CONSTRAINT expense_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);
