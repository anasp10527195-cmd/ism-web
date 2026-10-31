-- ========================================================
-- IHSAN SUPER MARKET (ISM) SUPABASE SCHEMA & FIX SCRIPT
-- ========================================================
-- Run this script in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/jtxcaicpbelwauawqvtg
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query" -> Paste this entire script -> Click "Run"
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- 1. ADMIN TABLE & VIEW
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Username" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure "Username" and "Password" columns exist if table was created differently
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin' AND column_name='Username') THEN
        ALTER TABLE public.admin ADD COLUMN "Username" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin' AND column_name='Password') THEN
        ALTER TABLE public.admin ADD COLUMN "Password" TEXT;
    END IF;
END $$;

-- Create view "Admin" so queries to both 'admin' and 'Admin' succeed in PostgREST
CREATE OR REPLACE VIEW public."Admin" AS
SELECT * FROM public.admin;

-- --------------------------------------------------------
-- 2. INSERT / INITIALIZE ADMIN ACCOUNT
-- --------------------------------------------------------
-- Update existing ism_manager or insert default if not exists:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin WHERE "Username" = 'ism_manager') THEN
        INSERT INTO public.admin ("Username", "Password") VALUES ('ism_manager', 'ism123456');
    END IF;
END $$;

-- --------------------------------------------------------
-- 3. ENABLE PERMISSIONS / RLS POLICIES FOR ISM TABLES
-- The ISM web app connects using the anon/publishable key.
-- Without policies on these tables, PostgREST returns empty arrays or 401 RLS violations.
-- --------------------------------------------------------

-- Helper to safely enable RLS and grant full anon access
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['admin', 'Students', 'Stock', 'Purchases', 'payments', 'Expense', 'unions', 'Deleted students'];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Check if table exists before applying policies
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

            -- Drop old policies to avoid duplicates
            EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Insert Access" ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Update Access" ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Delete Access" ON public.%I', tbl);

            -- Create universal access policy for anon & authenticated
            EXECUTE format('CREATE POLICY "Public Full Access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
        END IF;
    END LOOP;
END $$;

-- Grant usage on public schema and all tables/sequences to anon and authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
