-- ============================================================================
-- QUICKINK COMPLETE SUPABASE SETUP SCRIPT
-- Contains all migrations (1-4) and initial seed data in one file.
-- You can run this directly in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/sql/new
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: EXTENSIONS & ENUMS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE device_type AS ENUM ('shop', 'kiosk');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE device_status AS ENUM ('online', 'offline');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM (
        'pending_payment',
        'awaiting_redemption',
        'redeemed',
        'printed',
        'expired',
        'voided'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('online', 'cash');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE otp_type AS ENUM ('type_a', 'type_b');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM ('admin', 'superadmin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- PART 2: CORE ENTITIES
-- ----------------------------------------------------------------------------

-- Drop any conflicting legacy mock tables before creating the new schema
DROP TABLE IF EXISTS public.otps CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.print_jobs CASCADE;
DROP TABLE IF EXISTS public.operators CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. USERS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.users (id, email, phone, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.phone,
        COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        phone = COALESCE(EXCLUDED.phone, public.users.phone);
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_auth_user();
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Trigger on auth.users skipped due to role permissions; user profile synchronization can also be handled on client auth callback.';
END $$;

-- 2. DEVICES
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type device_type NOT NULL,
    name TEXT NOT NULL,
    location JSONB NOT NULL DEFAULT '{}'::jsonb,
    status device_status NOT NULL DEFAULT 'offline',
    owner_operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devices_updated_at ON public.devices;
CREATE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. OPERATORS
CREATE TABLE IF NOT EXISTS public.operators (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PRINT JOBS
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    file_path TEXT,
    file_type TEXT NOT NULL,
    copies INTEGER NOT NULL DEFAULT 1 CHECK (copies > 0),
    color_mode TEXT NOT NULL CHECK (color_mode IN ('color', 'bw')),
    duplex BOOLEAN NOT NULL DEFAULT false,
    page_count INTEGER NOT NULL DEFAULT 1 CHECK (page_count > 0),
    status job_status NOT NULL DEFAULT 'pending_payment',
    payment_type payment_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 minutes'),
    redeemed_at TIMESTAMPTZ,
    redeemed_by_device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    printed_at TIMESTAMPTZ
);

-- 5. OTPS
CREATE TABLE IF NOT EXISTS public.otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    print_job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    otp_type otp_type NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMPTZ,
    used_by_device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 6. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    print_job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    method payment_type NOT NULL,
    gateway_reference TEXT,
    status payment_status NOT NULL DEFAULT 'pending',
    cash_collected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ADMIN USERS
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role admin_role NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_devices_type_status ON public.devices(type, status);
CREATE INDEX IF NOT EXISTS idx_operators_device_id ON public.operators(device_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_user_id ON public.print_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_expires_at ON public.print_jobs(expires_at) 
    WHERE status IN ('pending_payment', 'awaiting_redemption');
CREATE INDEX IF NOT EXISTS idx_print_jobs_redeemed_device ON public.print_jobs(redeemed_by_device_id);
CREATE INDEX IF NOT EXISTS idx_otps_code_unused ON public.otps(code) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_otps_print_job_id ON public.otps(print_job_id);
CREATE INDEX IF NOT EXISTS idx_payments_print_job_id ON public.payments(print_job_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ----------------------------------------------------------------------------
-- PART 3: BUSINESS LOGIC, RPC & TRIGGERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_operator_device_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT device_id
    FROM public.operators
    WHERE id = auth.uid();
$$;

-- REDEEM OTP FUNCTION
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
    v_clean_code := upper(trim(p_code));

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RAISE EXCEPTION 'OTP code cannot be empty' USING ERRCODE = 'P0001';
    END IF;

    SELECT id, type, name, status
    INTO v_device
    FROM public.devices
    WHERE id = p_device_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device with ID % not found', p_device_id USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_otp
    FROM public.otps
    WHERE code = v_clean_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid OTP code' USING ERRCODE = 'P0003';
    END IF;

    IF v_otp.used THEN
        RAISE EXCEPTION 'This OTP has already been redeemed on %', v_otp.used_at USING ERRCODE = 'P0004';
    END IF;

    IF v_otp.expires_at < now() THEN
        RAISE EXCEPTION 'This OTP has expired on %', v_otp.expires_at USING ERRCODE = 'P0005';
    END IF;

    -- ENFORCE RULE: Type B OTP (cash) cannot be redeemed at kiosk
    IF v_otp.otp_type = 'type_b' AND v_device.type = 'kiosk' THEN
        RAISE EXCEPTION 'Cash-payment jobs (Type B OTP) cannot be redeemed at a kiosk terminal. Please redeem at a partner shop.'
            USING ERRCODE = 'P0006';
    END IF;

    SELECT *
    INTO v_job
    FROM public.print_jobs
    WHERE id = v_otp.print_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated print job not found' USING ERRCODE = 'P0007';
    END IF;

    IF v_job.status NOT IN ('awaiting_redemption', 'pending_payment') THEN
        RAISE EXCEPTION 'Print job is not eligible for redemption (current status: %)', v_job.status
            USING ERRCODE = 'P0008';
    END IF;

    UPDATE public.otps
    SET used = true,
        used_at = now(),
        used_by_device_id = p_device_id
    WHERE id = v_otp.id;

    UPDATE public.print_jobs
    SET status = 'redeemed',
        redeemed_at = now(),
        redeemed_by_device_id = p_device_id
    WHERE id = v_job.id
    RETURNING * INTO v_job;

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
            'payment_type', v_job.payment_type,
            'status', v_job.status,
            'redeemed_at', v_job.redeemed_at,
            'redeemed_by_device_id', v_job.redeemed_by_device_id
        ),
        'otp', jsonb_build_object(
            'id', v_otp.id,
            'otp_type', v_otp.otp_type,
            'used_at', now()
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_otp(TEXT, UUID) TO authenticated, service_role, anon;

-- DEFENSE-IN-DEPTH TRIGGER ON OTPS TABLE
CREATE OR REPLACE FUNCTION public.check_otp_redemption_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_device_type device_type;
BEGIN
    IF NEW.used = true AND NEW.used_by_device_id IS NOT NULL AND NEW.otp_type = 'type_b' THEN
        SELECT type INTO v_device_type
        FROM public.devices
        WHERE id = NEW.used_by_device_id;

        IF v_device_type = 'kiosk' THEN
            RAISE EXCEPTION 'Integrity violation: Type B OTP cannot be assigned to a kiosk device'
                USING ERRCODE = 'P0006';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_otp_redemption ON public.otps;
CREATE TRIGGER trg_check_otp_redemption
    BEFORE UPDATE ON public.otps
    FOR EACH ROW
    EXECUTE FUNCTION public.check_otp_redemption_rules();

-- AUTO-NULL file_path AND DELETE STORAGE OBJECT ON 'printed'
CREATE OR REPLACE FUNCTION public.handle_job_printed_before()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'printed' AND OLD.status <> 'printed' THEN
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

CREATE OR REPLACE FUNCTION public.handle_job_printed_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
BEGIN
    IF NEW.status = 'printed' AND OLD.status <> 'printed' AND OLD.file_path IS NOT NULL THEN
        BEGIN
            DELETE FROM storage.objects
            WHERE bucket_id = 'print-files'
              AND name = OLD.file_path;
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

-- ----------------------------------------------------------------------------
-- PART 4: STORAGE & EXPIRY CLEANUP
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'print-files',
        'print-files',
        false,
        52428800,
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
        public = false,
        file_size_limit = 52428800,
        allowed_mime_types = EXCLUDED.allowed_mime_types;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'storage.buckets not accessible directly; skipping bucket insertion';
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_print_jobs()
RETURNS TABLE (
    expired_jobs_count INTEGER,
    storage_files_deleted INTEGER,
    otps_invalidated INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
    v_job RECORD;
    v_jobs_count INTEGER := 0;
    v_files_count INTEGER := 0;
    v_otps_count INTEGER := 0;
BEGIN
    FOR v_job IN
        SELECT id, file_path
        FROM public.print_jobs
        WHERE expires_at < now()
          AND status IN ('pending_payment', 'awaiting_redemption')
        FOR UPDATE
    LOOP
        IF v_job.file_path IS NOT NULL THEN
            BEGIN
                DELETE FROM storage.objects
                WHERE bucket_id = 'print-files'
                  AND name = v_job.file_path;
                v_files_count := v_files_count + 1;
            EXCEPTION
                WHEN OTHERS THEN NULL;
            END;
        END IF;

        WITH invalidated AS (
            UPDATE public.otps
            SET used = true,
                used_at = now()
            WHERE print_job_id = v_job.id
              AND used = false
            RETURNING id
        )
        SELECT v_otps_count + count(*)::INTEGER INTO v_otps_count FROM invalidated;

        UPDATE public.print_jobs
        SET status = 'expired',
            file_path = NULL
        WHERE id = v_job.id;

        v_jobs_count := v_jobs_count + 1;
    END LOOP;

    RETURN QUERY SELECT v_jobs_count, v_files_count, v_otps_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_print_jobs() TO service_role, postgres;

DO $cron_setup$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
    IF EXISTS (
        SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
        WHERE pg_proc.proname = 'schedule' AND pg_namespace.nspname = 'cron'
    ) THEN
        BEGIN
            EXECUTE 'SELECT cron.unschedule(''quickink_cleanup_expired_jobs'')';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        EXECUTE 'SELECT cron.schedule(''quickink_cleanup_expired_jobs'', ''*/10 * * * *'', $cmd$SELECT * FROM public.cleanup_expired_print_jobs();$cmd$)';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron not enabled or restricted in this tier. Cleanup function public.cleanup_expired_print_jobs() can also be invoked via an Edge Function cron.';
END $cron_setup$;

-- ----------------------------------------------------------------------------
-- PART 5: ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- USERS POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins full access on users" ON public.users;
CREATE POLICY "Admins full access on users" ON public.users FOR ALL TO authenticated
    USING (public.is_admin());

-- DEVICES POLICIES
DROP POLICY IF EXISTS "Allow public read of active devices" ON public.devices;
CREATE POLICY "Allow public read of active devices" ON public.devices FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Operators can view assigned device" ON public.devices;
CREATE POLICY "Operators can view assigned device" ON public.devices FOR SELECT TO authenticated
    USING (id = public.get_operator_device_id() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage devices" ON public.devices;
CREATE POLICY "Admins manage devices" ON public.devices FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- OPERATORS POLICIES
DROP POLICY IF EXISTS "Operators can view own record" ON public.operators;
CREATE POLICY "Operators can view own record" ON public.operators FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage operators" ON public.operators;
CREATE POLICY "Admins manage operators" ON public.operators FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PRINT JOBS POLICIES
DROP POLICY IF EXISTS "Users view own print jobs" ON public.print_jobs;
CREATE POLICY "Users view own print jobs" ON public.print_jobs FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own print jobs" ON public.print_jobs;
CREATE POLICY "Users insert own print jobs" ON public.print_jobs FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users cancel own unredeemed jobs" ON public.print_jobs;
CREATE POLICY "Users cancel own unredeemed jobs" ON public.print_jobs FOR UPDATE TO authenticated
    USING (user_id = auth.uid() AND status IN ('pending_payment', 'awaiting_redemption'))
    WITH CHECK (user_id = auth.uid() AND status = 'voided');

DROP POLICY IF EXISTS "Operators view redeemed jobs for their device" ON public.print_jobs;
CREATE POLICY "Operators view redeemed jobs for their device" ON public.print_jobs FOR SELECT TO authenticated
    USING (redeemed_by_device_id IS NOT NULL AND redeemed_by_device_id = public.get_operator_device_id());

DROP POLICY IF EXISTS "Operators update printed status for their device" ON public.print_jobs;
CREATE POLICY "Operators update printed status for their device" ON public.print_jobs FOR UPDATE TO authenticated
    USING (redeemed_by_device_id IS NOT NULL AND redeemed_by_device_id = public.get_operator_device_id())
    WITH CHECK (redeemed_by_device_id = public.get_operator_device_id() AND status IN ('redeemed', 'printed'));

DROP POLICY IF EXISTS "Admins full access on print_jobs" ON public.print_jobs;
CREATE POLICY "Admins full access on print_jobs" ON public.print_jobs FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- OTPS POLICIES (No direct SELECT for users/operators)
DROP POLICY IF EXISTS "Admins can view and manage otps" ON public.otps;
CREATE POLICY "Admins can view and manage otps" ON public.otps FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_my_job_otp(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_otp RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.print_jobs
        WHERE id = p_job_id AND user_id = auth.uid()
    ) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: You do not own this print job' USING ERRCODE = '42501';
    END IF;

    SELECT code, otp_type, expires_at, used
    INTO v_otp
    FROM public.otps
    WHERE print_job_id = p_job_id
    ORDER BY expires_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No OTP found for this job');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'code', v_otp.code,
        'otp_type', v_otp.otp_type,
        'expires_at', v_otp.expires_at,
        'used', v_otp.used
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_job_otp(UUID) TO authenticated;

-- PAYMENTS POLICIES
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.id = payments.print_job_id
              AND print_jobs.user_id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Operators view payments for redeemed jobs" ON public.payments;
CREATE POLICY "Operators view payments for redeemed jobs" ON public.payments FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.id = payments.print_job_id
              AND print_jobs.redeemed_by_device_id = public.get_operator_device_id()
        )
    );

DROP POLICY IF EXISTS "Operators toggle cash collected" ON public.payments;
CREATE POLICY "Operators toggle cash collected" ON public.payments FOR UPDATE TO authenticated
    USING (
        method = 'cash'
        AND EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.id = payments.print_job_id
              AND print_jobs.redeemed_by_device_id = public.get_operator_device_id()
        )
    )
    WITH CHECK (method = 'cash');

DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ADMIN USERS POLICIES
DROP POLICY IF EXISTS "Admins manage admin_users" ON public.admin_users;
CREATE POLICY "Admins manage admin_users" ON public.admin_users FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- STORAGE POLICIES
DROP POLICY IF EXISTS "Authenticated users can upload print files" ON storage.objects;
CREATE POLICY "Authenticated users can upload print files" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'print-files');

DROP POLICY IF EXISTS "Users can read own uploaded files" ON storage.objects;
CREATE POLICY "Users can read own uploaded files" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'print-files' AND (auth.uid() = owner OR public.is_admin()));

DROP POLICY IF EXISTS "Operators can download file for redeemed job" ON storage.objects;
CREATE POLICY "Operators can download file for redeemed job" ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'print-files'
        AND EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.file_path = storage.objects.name
              AND print_jobs.status = 'redeemed'
              AND print_jobs.redeemed_by_device_id = public.get_operator_device_id()
        )
    );

-- ----------------------------------------------------------------------------
-- PART 6: SEED DATA (SAMPLE DEVICES & TEST JOBS)
-- ----------------------------------------------------------------------------

-- Device 1: Partner Print Shop
INSERT INTO public.devices (id, type, name, location, status)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'shop',
    'QuickInk Partner Shop - Dhanmondi',
    '{
        "address": "House 23, Road 5, Dhanmondi, Dhaka-1205",
        "latitude": 23.7461,
        "longitude": 90.3742,
        "phone": "+8801700000001",
        "operating_hours": "09:00 AM - 10:00 PM"
    }'::jsonb,
    'online'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    status = EXCLUDED.status;

-- Device 2: Self-Service Kiosk
INSERT INTO public.devices (id, type, name, location, status)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'kiosk',
    'QuickInk Kiosk - Central Mall',
    '{
        "address": "Level 1, Central Shopping Mall, Dhanmondi, Dhaka",
        "latitude": 23.7510,
        "longitude": 90.3780,
        "operating_hours": "24/7 Automated"
    }'::jsonb,
    'online'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    status = EXCLUDED.status;

-- Test Job 1: Online Paid (Type A OTP: QK1001) - Valid at both Shop and Kiosk
INSERT INTO public.print_jobs (
    id, file_path, file_type, copies, color_mode, duplex, page_count, status, payment_type, created_at, expires_at
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'sample-docs/university_assignment.pdf',
    'pdf', 2, 'bw', false, 5, 'awaiting_redemption', 'online', now(), now() + INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, print_job_id, amount, method, gateway_reference, status, cash_collected)
VALUES (
    '44444444-0000-0000-0000-000000000001',
    '44444444-4444-4444-4444-444444444444',
    20.00, 'online', 'bkash_tx_998822', 'completed', false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.otps (id, print_job_id, code, otp_type, used, expires_at)
VALUES (
    '44444444-0000-0000-0000-000000000002',
    '44444444-4444-4444-4444-444444444444',
    'QK1001', 'type_a', false, now() + INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

-- Test Job 2: Cash Payment (Type B OTP: QK2002) - Valid at Shop ONLY (Rejected at Kiosk)
INSERT INTO public.print_jobs (
    id, file_path, file_type, copies, color_mode, duplex, page_count, status, payment_type, created_at, expires_at
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'sample-docs/tax_return_form.pdf',
    'pdf', 1, 'color', true, 8, 'awaiting_redemption', 'cash', now(), now() + INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, print_job_id, amount, method, gateway_reference, status, cash_collected)
VALUES (
    '55555555-0000-0000-0000-000000000001',
    '55555555-5555-5555-5555-555555555555',
    64.00, 'cash', NULL, 'pending', false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.otps (id, print_job_id, code, otp_type, used, expires_at)
VALUES (
    '55555555-0000-0000-0000-000000000002',
    '55555555-5555-5555-5555-555555555555',
    'QK2002', 'type_b', false, now() + INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- PART 7: ATOMIC ORDER CREATION RPC & GUEST CHECKOUT POLICIES
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_print_job(
    p_file_path TEXT,
    p_file_type TEXT,
    p_copies INTEGER,
    p_color_mode TEXT,
    p_duplex BOOLEAN,
    p_page_count INTEGER,
    p_payment_type TEXT,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_job_id UUID;
    v_otp_code TEXT;
    v_otp_type otp_type;
    v_expires_at TIMESTAMPTZ;
    v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_i INTEGER;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF lower(p_payment_type) = 'cash' THEN
        v_otp_type := 'type_b';
    ELSE
        v_otp_type := 'type_a';
    END IF;

    v_expires_at := now() + INTERVAL '60 minutes';

    LOOP
        v_otp_code := 'QK';
        FOR v_i IN 1..4 LOOP
            v_otp_code := v_otp_code || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
        END LOOP;

        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.otps WHERE code = v_otp_code AND used = false);
    END LOOP;

    INSERT INTO public.print_jobs (
        user_id, file_path, file_type, copies, color_mode, duplex, page_count, status, payment_type, expires_at
    ) VALUES (
        v_user_id, p_file_path, lower(p_file_type), GREATEST(1, p_copies), lower(p_color_mode),
        COALESCE(p_duplex, false), GREATEST(1, p_page_count), 'awaiting_redemption',
        lower(p_payment_type)::payment_type, v_expires_at
    ) RETURNING id INTO v_job_id;

    INSERT INTO public.otps (
        print_job_id, code, otp_type, used, expires_at
    ) VALUES (
        v_job_id, v_otp_code, v_otp_type, false, v_expires_at
    );

    INSERT INTO public.payments (
        print_job_id, amount, method, gateway_reference, status, cash_collected
    ) VALUES (
        v_job_id, COALESCE(p_amount, 0), lower(p_payment_type)::payment_type,
        CASE WHEN lower(p_payment_type) = 'online' THEN 'sim_' || extract(epoch from now())::BIGINT ELSE NULL END,
        CASE WHEN lower(p_payment_type) = 'online' THEN 'completed'::payment_status ELSE 'pending'::payment_status END,
        false
    );

    RETURN jsonb_build_object(
        'success', true,
        'order', jsonb_build_object(
            'id', v_job_id,
            'file_path', p_file_path,
            'copies', GREATEST(1, p_copies),
            'color_mode', lower(p_color_mode),
            'duplex', COALESCE(p_duplex, false),
            'page_count', GREATEST(1, p_page_count),
            'payment_type', lower(p_payment_type),
            'status', 'awaiting_redemption',
            'expires_at', v_expires_at,
            'amount', COALESCE(p_amount, 0)
        ),
        'otp', jsonb_build_object(
            'code', v_otp_code,
            'otp_type', v_otp_type,
            'expires_at', v_expires_at
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_print_job(TEXT, TEXT, INTEGER, TEXT, BOOLEAN, INTEGER, TEXT, NUMERIC) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow public insert of print jobs" ON public.print_jobs;
CREATE POLICY "Allow public insert of print jobs" ON public.print_jobs FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert of payments" ON public.payments;
CREATE POLICY "Allow public insert of payments" ON public.payments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- PART 8: ZONE / TIER-BASED PRICING (Model 2)
-- ----------------------------------------------------------------------------

-- 8.1  Create pricing_tiers table
CREATE TABLE IF NOT EXISTS public.pricing_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    bw_price NUMERIC(8, 2) NOT NULL DEFAULT 2.00 CHECK (bw_price >= 0),
    color_price NUMERIC(8, 2) NOT NULL DEFAULT 8.00 CHECK (color_price >= 0),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_pricing_tiers_updated_at ON public.pricing_tiers;
CREATE TRIGGER trg_pricing_tiers_updated_at
    BEFORE UPDATE ON public.pricing_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Only one tier can be the default at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_tiers_single_default
    ON public.pricing_tiers (is_default)
    WHERE is_default = true;

-- 8.2  Add pricing_tier_id FK column to devices
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS pricing_tier_id UUID REFERENCES public.pricing_tiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_pricing_tier_id ON public.devices(pricing_tier_id);

-- 8.3  Seed default pricing tiers
INSERT INTO public.pricing_tiers (id, name, description, bw_price, color_price, is_default)
VALUES
    (
        'aaaaaaaa-0000-0000-0000-000000000001',
        'Standard',
        'Default platform rate for general partner shops and kiosks.',
        2.00, 8.00, true
    ),
    (
        'aaaaaaaa-0000-0000-0000-000000000002',
        'Campus',
        'Discounted rate for university campuses and student hubs.',
        1.50, 6.00, false
    ),
    (
        'aaaaaaaa-0000-0000-0000-000000000003',
        'Commercial',
        'Premium rate for high-footfall commercial zones and malls.',
        3.00, 10.00, false
    )
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    bw_price = EXCLUDED.bw_price,
    color_price = EXCLUDED.color_price,
    is_default = EXCLUDED.is_default,
    updated_at = now();

-- Assign existing seed devices to Standard tier if unassigned
UPDATE public.devices
SET pricing_tier_id = 'aaaaaaaa-0000-0000-0000-000000000001'
WHERE pricing_tier_id IS NULL;

-- 8.4  RLS on pricing_tiers
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read pricing tiers" ON public.pricing_tiers;
CREATE POLICY "Public read pricing tiers" ON public.pricing_tiers
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage pricing tiers" ON public.pricing_tiers;
CREATE POLICY "Admins manage pricing tiers" ON public.pricing_tiers
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8.5  Helper RPC: get effective pricing for a device (falls back to default tier)
CREATE OR REPLACE FUNCTION public.get_device_pricing(p_device_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tier RECORD;
BEGIN
    SELECT pt.id, pt.name, pt.bw_price, pt.color_price
    INTO v_tier
    FROM public.devices d
    LEFT JOIN public.pricing_tiers pt ON pt.id = d.pricing_tier_id
    WHERE d.id = p_device_id;

    IF NOT FOUND OR v_tier.id IS NULL THEN
        SELECT id, name, bw_price, color_price
        INTO v_tier
        FROM public.pricing_tiers
        WHERE is_default = true
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'tier_id', null, 'tier_name', 'Standard',
            'bw_price', 2.00, 'color_price', 8.00
        );
    END IF;

    RETURN jsonb_build_object(
        'tier_id', v_tier.id,
        'tier_name', v_tier.name,
        'bw_price', v_tier.bw_price,
        'color_price', v_tier.color_price
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_pricing(UUID) TO anon, authenticated, service_role;


