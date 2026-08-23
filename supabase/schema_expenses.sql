-- ==============================================================================
-- Table: expenses
-- Description: Suivi des dépenses d'exploitation pour chaque commerce (multi-tenant)
-- ==============================================================================

-- 1. Create Enum for expense categories if not already existing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category') THEN
    CREATE TYPE expense_category AS ENUM (
      'loyer',
      'salaires',
      'materiel',
      'achats_stock',
      'autre'
    );
  END IF;
END $$;

-- 2. Create the expenses table
-- Note: La table du personnel dans Supabase est "platform_staff" (alias "staff" si schéma historique).
-- La clé étrangère pointe vers public.platform_staff (ou public.staff selon votre configuration).
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category expense_category NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.platform_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON public.expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 5. Multi-tenant RLS Policies
DROP POLICY IF EXISTS "Merchants can view their own business expenses" ON public.expenses;
CREATE POLICY "Merchants can view their own business expenses"
  ON public.expenses
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.platform_staff WHERE auth_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Merchants can insert expenses for their business" ON public.expenses;
CREATE POLICY "Merchants can insert expenses for their business"
  ON public.expenses
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.platform_staff WHERE auth_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Merchants can update their business expenses" ON public.expenses;
CREATE POLICY "Merchants can update their business expenses"
  ON public.expenses
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM public.platform_staff WHERE auth_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Merchants can delete their business expenses" ON public.expenses;
CREATE POLICY "Merchants can delete their business expenses"
  ON public.expenses
  FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM public.platform_staff WHERE auth_uid = auth.uid()
    )
  );
