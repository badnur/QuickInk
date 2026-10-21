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

-- Allow deletion after printing (Zero-retention privacy promise)
DROP POLICY IF EXISTS "Allow public delete from print-files" ON storage.objects;
CREATE POLICY "Allow public delete from print-files"
ON storage.objects FOR DELETE
TO public, anon, authenticated
USING (bucket_id = 'print-files');

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

-- ----------------------------------------------------------------------------
-- 7. ZERO-RETENTION PRIVACY GUARANTEE: STORAGE CLEANUP TRIGGERS & RPC
-- ----------------------------------------------------------------------------

-- Trigger: Automatically nullify file_path before marking job as printed or completed
CREATE OR REPLACE FUNCTION public.handle_job_printed_before()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW.status IN ('printed', 'completed')) AND (OLD.status NOT IN ('printed', 'completed')) THEN
        NEW.file_path := NULL;
        NEW.printed_at := COALESCE(NEW.printed_at, now());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_printed_before ON public.print_jobs;
CREATE TRIGGER trg_job_printed_before
    BEFORE UPDATE ON public.print_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_job_printed_before();

-- Trigger: Automatically remove file from storage.objects after job printed or completed
CREATE OR REPLACE FUNCTION public.handle_job_printed_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
BEGIN
    IF (NEW.status IN ('printed', 'completed')) AND (OLD.status NOT IN ('printed', 'completed')) AND OLD.file_path IS NOT NULL THEN
        BEGIN
            DELETE FROM storage.objects
            WHERE bucket_id = 'print-files'
              AND (
                  name = OLD.file_path
                  OR name = regexp_replace(OLD.file_path, '^jobs/', '')
                  OR name = 'jobs/' || regexp_replace(OLD.file_path, '^jobs/', '')
                  OR name = split_part(OLD.file_path, '#', 1)
                  OR name = 'jobs/' || split_part(regexp_replace(OLD.file_path, '^jobs/', ''), '#', 1)
              );
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Could not delete storage object %: %', OLD.file_path, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_printed_after ON public.print_jobs;
CREATE TRIGGER trg_job_printed_after
    AFTER UPDATE ON public.print_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_job_printed_after();

-- Update confirm_print_and_deduct_credits to delete storage file immediately inside transaction
CREATE OR REPLACE FUNCTION public.confirm_print_and_deduct_credits(
    p_job_id UUID,
    p_device_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
    v_device RECORD;
    v_job RECORD;
    v_tier RECORD;
    v_unit_price NUMERIC(8, 2);
    v_credit_cost NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_copies INT;
    v_page_count INT;
    v_is_color BOOLEAN;
BEGIN
    SELECT * INTO v_device FROM public.devices WHERE id = p_device_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Device not found' USING ERRCODE = 'P0002'; END IF;

    SELECT * INTO v_job FROM public.print_jobs WHERE id = p_job_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Print job not found' USING ERRCODE = 'P0007'; END IF;

    IF v_job.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_completed', true,
            'credits_deducted', 0,
            'balance', v_device.credits_balance,
            'message', 'Job was already confirmed and completed'
        );
    END IF;

    SELECT pt.id, pt.name, pt.bw_price, pt.color_price
    INTO v_tier
    FROM public.devices d
    LEFT JOIN public.pricing_tiers pt ON pt.id = d.pricing_tier_id
    WHERE d.id = p_device_id;

    IF NOT FOUND OR v_tier.id IS NULL THEN
        SELECT id, name, bw_price, color_price INTO v_tier FROM public.pricing_tiers WHERE is_default = true LIMIT 1;
    END IF;

    v_is_color := (v_job.color_mode = 'color');
    v_unit_price := CASE 
        WHEN v_is_color THEN COALESCE(v_tier.color_price, 8.00)
        ELSE COALESCE(v_tier.bw_price, 2.00)
    END;

    v_copies := COALESCE(v_job.copies, 1);
    v_page_count := COALESCE(v_job.page_count, 1);
    v_credit_cost := ROUND(v_unit_price * v_page_count * v_copies, 2);
    v_new_balance := GREATEST(0.00, v_device.credits_balance - v_credit_cost);

    UPDATE public.devices
    SET credits_balance = v_new_balance,
        location = jsonb_set(COALESCE(location, '{}'::jsonb), '{credits_balance}', to_jsonb(v_new_balance)),
        updated_at = now()
    WHERE id = p_device_id;

    -- Zero-Retention Privacy: Immediately purge physical file from storage.objects
    IF v_job.file_path IS NOT NULL THEN
        BEGIN
            DELETE FROM storage.objects
            WHERE bucket_id = 'print-files'
              AND (
                  name = v_job.file_path
                  OR name = regexp_replace(v_job.file_path, '^jobs/', '')
                  OR name = 'jobs/' || regexp_replace(v_job.file_path, '^jobs/', '')
                  OR name = split_part(v_job.file_path, '#', 1)
                  OR name = 'jobs/' || split_part(regexp_replace(v_job.file_path, '^jobs/', ''), '#', 1)
              );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- Update print job status to completed and clear file_path
    UPDATE public.print_jobs
    SET status = 'completed',
        file_path = NULL,
        printed_at = now(),
        redeemed_by_device_id = p_device_id
    WHERE id = p_job_id;

    INSERT INTO public.partner_credit_transactions (
        device_id, amount, balance_after, type, description, print_job_id, metadata
    ) VALUES (
        p_device_id, -v_credit_cost, v_new_balance, 'print_deduction',
        format('Print Job Completed: %s sheet(s) %s × %s copy @ ৳%s/sheet', v_page_count, CASE WHEN v_is_color THEN 'Color' ELSE 'B&W' END, v_copies, v_unit_price),
        p_job_id,
        jsonb_build_object('page_count', v_page_count, 'copies', v_copies, 'color_mode', v_job.color_mode, 'unit_price', v_unit_price, 'tier_name', COALESCE(v_tier.name, 'Standard'))
    );

    RETURN jsonb_build_object(
        'success', true,
        'credits_deducted', v_credit_cost,
        'unit_price', v_unit_price,
        'previous_balance', v_device.credits_balance,
        'balance', v_new_balance,
        'job_id', p_job_id,
        'message', format('Print confirmed. %s credits deducted.', v_credit_cost)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_print_and_deduct_credits(UUID, UUID) TO anon, authenticated, service_role;

-- Bulk cleanup RPC to immediately purge all existing historical & orphaned print files
CREATE OR REPLACE FUNCTION public.purge_completed_and_orphaned_print_files()
RETURNS TABLE (
    completed_jobs_cleared INTEGER,
    storage_files_deleted INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
    v_job RECORD;
    v_jobs_cleared INTEGER := 0;
    v_files_deleted INTEGER := 0;
    v_obj RECORD;
BEGIN
    -- 1. For all non-pending jobs with non-null file_path: remove from storage & clear DB reference
    FOR v_job IN
        SELECT id, file_path
        FROM public.print_jobs
        WHERE file_path IS NOT NULL
          AND (
              status::text IN ('printed', 'expired', 'voided', 'failed', 'completed')
              OR (status::text = 'redeemed' AND created_at < (now() - INTERVAL '1 hour'))
              OR (status::text NOT IN ('pending_payment', 'awaiting_redemption'))
          )
        FOR UPDATE
    LOOP
        BEGIN
            DELETE FROM storage.objects
            WHERE bucket_id = 'print-files'
              AND (
                  name = v_job.file_path
                  OR name = regexp_replace(v_job.file_path, '^jobs/', '')
                  OR name = 'jobs/' || regexp_replace(v_job.file_path, '^jobs/', '')
                  OR name = split_part(v_job.file_path, '#', 1)
                  OR name = 'jobs/' || split_part(regexp_replace(v_job.file_path, '^jobs/', ''), '#', 1)
              );
            v_files_deleted := v_files_deleted + 1;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        UPDATE public.print_jobs
        SET file_path = NULL
        WHERE id = v_job.id;

        v_jobs_cleared := v_jobs_cleared + 1;
    END LOOP;

    -- 2. Delete any file in storage.objects created more than 1 hour ago that is not linked to an active pending job
    FOR v_obj IN
        SELECT name
        FROM storage.objects
        WHERE bucket_id = 'print-files'
          AND created_at < (now() - INTERVAL '1 hour')
          AND NOT EXISTS (
              SELECT 1 FROM public.print_jobs pj
              WHERE pj.status::text IN ('pending_payment', 'awaiting_redemption')
                AND pj.file_path IS NOT NULL
                AND (
                    pj.file_path = storage.objects.name
                    OR pj.file_path LIKE '%' || storage.objects.name
                    OR storage.objects.name LIKE '%' || split_part(pj.file_path, '#', 1)
                )
          )
    LOOP
        BEGIN
            DELETE FROM storage.objects
            WHERE bucket_id = 'print-files'
              AND name = v_obj.name;
            v_files_deleted := v_files_deleted + 1;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;

    RETURN QUERY SELECT v_jobs_cleared, v_files_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_completed_and_orphaned_print_files() TO anon, authenticated, service_role;

-- Immediately run historical cleanup once to purge any currently lingering print files
SELECT * FROM public.purge_completed_and_orphaned_print_files();


