-- ========================================================
-- GOOGLE APPS SCRIPT / SHEET TO SUPABASE MIGRATION SCHEMA
-- ========================================================
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New Query -> Paste & Run
-- ========================================================

-- Enable UUID extension for unique primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Example Table: App Records (Replace/Adjust columns to match your Google Sheet header columns)
CREATE TABLE IF NOT EXISTS public.records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Custom columns matching typical Google Sheet headers:
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    category TEXT,
    status TEXT DEFAULT 'active' NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Trigger for automatically updating updated_at on record edit
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_timestamp ON public.records;
CREATE TRIGGER trigger_set_timestamp
    BEFORE UPDATE ON public.records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. Indexes for fast search and filtering
CREATE INDEX IF NOT EXISTS idx_records_created_at ON public.records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_status ON public.records (status);
CREATE INDEX IF NOT EXISTS idx_records_email ON public.records (email);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies
-- Policy A: Allow anyone (public/anon users) to read records
CREATE POLICY "Public Read Access" 
ON public.records 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- Policy B: Allow anyone (public/anon users) to submit new records (equivalent to Google Forms / public web app)
CREATE POLICY "Public Insert Access" 
ON public.records 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Policy C: Allow updates (can be locked down to authenticated admin users)
CREATE POLICY "Authenticated Update Access" 
ON public.records 
FOR UPDATE 
TO anon, authenticated 
USING (true)
WITH CHECK (true);

-- Policy D: Allow deletions (can be locked down to authenticated admin users)
CREATE POLICY "Authenticated Delete Access" 
ON public.records 
FOR DELETE 
TO anon, authenticated 
USING (true);
