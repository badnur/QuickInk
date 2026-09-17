-- ============================================================================
-- QUICKINK ONE-CLICK SUPABASE SETUP & FIX SCRIPT
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/sql/new
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX STORAGE BUCKET & RLS POLICIES (Fixes "violates row-level security policy")
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'print-files',
    'print-files',
    true, -- Make bucket publicly accessible for customer uploads and desktop downloads
    52428800, -- 50MB
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800;

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Allow public uploads to print-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from print-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update to print-files" ON storage.objects;

-- Allow anonymous and authenticated users to upload files to print-files bucket
CREATE POLICY "Allow public uploads to print-files"
ON storage.objects FOR INSERT
TO public, anon, authenticated
WITH CHECK (bucket_id = 'print-files');

-- Allow anonymous and authenticated users to read and download files from print-files
CREATE POLICY "Allow public read from print-files"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id = 'print-files');

-- Allow updates
CREATE POLICY "Allow public update to print-files"
ON storage.objects FOR UPDATE
TO public, anon, authenticated
USING (bucket_id = 'print-files')
WITH CHECK (bucket_id = 'print-files');

-- ----------------------------------------------------------------------------
-- 2. SEED DEFAULT DEVICES & FIX DEVICES RLS
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of active devices" ON public.devices;
CREATE POLICY "Allow public read of active devices"
ON public.devices FOR SELECT
TO public, anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public insert of devices" ON public.devices;
CREATE POLICY "Allow public insert of devices"
ON public.devices FOR INSERT
TO public, anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update of devices" ON public.devices;
CREATE POLICY "Allow public update of devices"
ON public.devices FOR UPDATE
TO public, anon, authenticated
USING (true)
WITH CHECK (true);

-- Insert Default Demo Devices
INSERT INTO public.devices (
    id,
    type,
    name,
    location,
    status
) VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'shop',
    'QuickInk Partner Shop - Dhanmondi',
    '{
        "address": "House 23, Road 5, Dhanmondi, Dhaka-1205",
        "phone": "+880 1733-398911",
        "operating_hours": "09:00 AM - 10:00 PM"
    }'::jsonb,
    'online'
),
(
    '22222222-2222-2222-2222-222222222222',
    'kiosk',
    'QuickInk Kiosk - Central Mall',
    '{
        "address": "Level 1, Central Shopping Mall, Dhanmondi, Dhaka",
        "operating_hours": "24/7 Automated"
    }'::jsonb,
    'online'
),
(
    '33333333-3333-3333-3333-333333333333',
    'shop',
    'QuickInk Partner Shop - University Campus',
    '{
        "address": "Near Central Library, University Campus, Dhaka",
        "phone": "+880 1712-345678",
        "operating_hours": "08:00 AM - 09:00 PM"
    }'::jsonb,
    'online'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    status = EXCLUDED.status;

-- ----------------------------------------------------------------------------
-- 3. ENHANCED AUTO-PROVISIONING redeem_otp FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_otp(
    p_code TEXT,
    p_device_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_device RECORD;
    v_otp RECORD;
    v_job RECORD;
    v_clean_code TEXT;
BEGIN
    -- Sanitize input code (trim whitespace, uppercase)
    v_clean_code := upper(trim(p_code));

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RAISE EXCEPTION 'OTP code cannot be empty'
            USING ERRCODE = 'P0001';
    END IF;

    -- 1. Locate OTP record first
    SELECT *
    INTO v_otp
    FROM public.otps
    WHERE code = v_clean_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid OTP code: %', v_clean_code
            USING ERRCODE = 'P0003';
    END IF;

    -- 2. Check if OTP is already used
    IF v_otp.used THEN
        RAISE EXCEPTION 'This OTP has already been redeemed on %', v_otp.used_at
            USING ERRCODE = 'P0004';
    END IF;

    -- 3. Check if OTP has expired
    IF v_otp.expires_at < now() THEN
        RAISE EXCEPTION 'This OTP has expired on %', v_otp.expires_at
            USING ERRCODE = 'P0005';
    END IF;

    -- 4. Locate device or auto-provision standard default device
    SELECT id, type, name, status
    INTO v_device
    FROM public.devices
    WHERE id = p_device_id;

    IF NOT FOUND THEN
        INSERT INTO public.devices (id, type, name, status)
        VALUES (p_device_id, 'shop', 'QuickInk Partner Shop - Dhanmondi', 'online')
        ON CONFLICT (id) DO NOTHING;

        SELECT id, type, name, status
        INTO v_device
        FROM public.devices
        WHERE id = p_device_id;
    END IF;

    -- 5. Business rule: Type B (Cash) rejected at unattended kiosk
    IF v_otp.otp_type = 'type_b' AND v_device.type = 'kiosk' THEN
        RAISE EXCEPTION 'Cash-payment jobs (Type B OTP) cannot be redeemed at a kiosk terminal. Please redeem at a partner shop.'
            USING ERRCODE = 'P0006';
    END IF;

    -- 6. Retrieve associated print job
    SELECT *
    INTO v_job
    FROM public.print_jobs
    WHERE id = v_otp.print_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated print job not found'
            USING ERRCODE = 'P0007';
    END IF;

    -- 7. Atomically mark OTP as used
    UPDATE public.otps
    SET used = true,
        used_at = now(),
        used_by_device_id = v_device.id
    WHERE id = v_otp.id;

    -- 8. Atomically update print job to 'redeemed'
    UPDATE public.print_jobs
    SET status = 'redeemed',
        redeemed_at = now(),
        redeemed_by_device_id = v_device.id
    WHERE id = v_job.id
    RETURNING * INTO v_job;

    -- 9. Return detailed payload for desktop terminal
    RETURN jsonb_build_object(
        'success', true,
        'message', 'OTP redeemed successfully',
        'device', jsonb_build_object(
            'id', v_device.id,
            'name', v_device.name,
            'type', v_device.type
        ),
        'print_job', jsonb_build_object(
            'id', v_job.id,
            'user_id', v_job.user_id,
            'file_path', v_job.file_path,
            'file_type', v_job.file_type,
            'copies', v_job.copies,
            'color_mode', v_job.color_mode,
            'duplex', v_job.duplex,
            'page_count', v_job.page_count,
            'page_range', v_job.page_range,
            'payment_type', v_job.payment_type,
            'status', v_job.status,
            'redeemed_at', v_job.redeemed_at,
            'redeemed_by_device_id', v_job.redeemed_by_device_id
        ),
        'otp', jsonb_build_object(
            'id', v_otp.id,
            'code', v_otp.code,
            'otp_type', v_otp.otp_type,
            'used_at', now()
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_otp(TEXT, UUID) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. FIX RLS FOR PRINT_JOBS AND OTPS (Allows anonymous orders & desktop polling)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anon create print jobs" ON public.print_jobs;
CREATE POLICY "Allow anon create print jobs"
ON public.print_jobs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read redeemed jobs for terminal" ON public.print_jobs;
CREATE POLICY "Allow read redeemed jobs for terminal"
ON public.print_jobs FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow anon update print jobs" ON public.print_jobs;
CREATE POLICY "Allow anon update print jobs"
ON public.print_jobs FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon create otps" ON public.otps;
CREATE POLICY "Allow anon create otps"
ON public.otps FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. ADD page_range COLUMN TO print_jobs (Safe migration — runs only if missing)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'print_jobs'
      AND column_name  = 'page_range'
  ) THEN
    ALTER TABLE public.print_jobs
      ADD COLUMN page_range TEXT DEFAULT NULL;
    COMMENT ON COLUMN public.print_jobs.page_range IS
      'Optional SumatraPDF-compatible page range string (e.g. "1-3,5"). NULL = print all pages.';
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. PARTNER SHOP & KIOSK REGISTRATION TABLE & RLS POLICIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT UNIQUE,
    type TEXT NOT NULL DEFAULT 'shop', -- 'shop' or 'kiosk'
    name TEXT NOT NULL,                -- Applicant / Contact person name
    shop_name TEXT NOT NULL,           -- Business / Venue name
    phone TEXT NOT NULL,
    email TEXT,
    location TEXT NOT NULL,            -- Detailed address
    city TEXT DEFAULT 'Dhaka',
    operating_hours TEXT DEFAULT '09:00 AM - 10:00 PM',
    printer_model TEXT,                -- For shops: existing printers (e.g. Epson L130, Canon, HP)
    space_type TEXT,                   -- For kiosks: 'Mall', 'University / Campus', 'Hospital', 'Commercial Hub'
    daily_footfall TEXT,
    power_backup BOOLEAN DEFAULT true,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'onboarded'
    rejection_reason TEXT,
    provisioned_device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    commission_rate NUMERIC DEFAULT 40.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert of partner applications" ON public.partners;
CREATE POLICY "Allow public insert of partner applications"
ON public.partners FOR INSERT
TO anon, authenticated, public
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of partner applications" ON public.partners;
CREATE POLICY "Allow public read of partner applications"
ON public.partners FOR SELECT
TO anon, authenticated, public
USING (true);

DROP POLICY IF EXISTS "Allow update of partner applications" ON public.partners;
CREATE POLICY "Allow update of partner applications"
ON public.partners FOR UPDATE
TO anon, authenticated, public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete of partner applications" ON public.partners;
CREATE POLICY "Allow delete of partner applications"
ON public.partners FOR DELETE
TO anon, authenticated, public
USING (true);

