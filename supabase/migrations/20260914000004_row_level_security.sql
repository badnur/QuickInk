-- Migration 000004: Row Level Security (RLS) Policies
-- Implements granular security controls across all core entities:
-- 1. Users can only query their own jobs, payments, and profile.
-- 2. Operators cannot browse all print jobs; they can ONLY query jobs redeemed at their assigned device.
-- 3. OTP table has NO general SELECT policy (read only via secure redeem_otp RPC or user own-job getter).
-- 4. Admins bypass restrictions via is_admin() checks.

--------------------------------------------------------------------------------
-- 1. ENABLE RLS ON ALL CORE TABLES
--------------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 2. POLICIES: public.users
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins full access on users" ON public.users;
CREATE POLICY "Admins full access on users"
    ON public.users
    FOR ALL
    TO authenticated
    USING (public.is_admin());

--------------------------------------------------------------------------------
-- 3. POLICIES: public.devices
--------------------------------------------------------------------------------
-- Anyone (including anon & clients) can view active devices for the kiosk map/list
DROP POLICY IF EXISTS "Allow public read of active devices" ON public.devices;
CREATE POLICY "Allow public read of active devices"
    ON public.devices
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Operators can view assigned device" ON public.devices;
CREATE POLICY "Operators can view assigned device"
    ON public.devices
    FOR SELECT
    TO authenticated
    USING (id = public.get_operator_device_id() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage devices" ON public.devices;
CREATE POLICY "Admins manage devices"
    ON public.devices
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

--------------------------------------------------------------------------------
-- 4. POLICIES: public.operators
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Operators can view own record" ON public.operators;
CREATE POLICY "Operators can view own record"
    ON public.operators
    FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage operators" ON public.operators;
CREATE POLICY "Admins manage operators"
    ON public.operators
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

--------------------------------------------------------------------------------
-- 5. POLICIES: public.print_jobs
--------------------------------------------------------------------------------
-- End customers see their own jobs
DROP POLICY IF EXISTS "Users view own print jobs" ON public.print_jobs;
CREATE POLICY "Users view own print jobs"
    ON public.print_jobs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- Customers can create print jobs for themselves
DROP POLICY IF EXISTS "Users insert own print jobs" ON public.print_jobs;
CREATE POLICY "Users insert own print jobs"
    ON public.print_jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Customers can void/cancel their own unredeemed jobs
DROP POLICY IF EXISTS "Users cancel own unredeemed jobs" ON public.print_jobs;
CREATE POLICY "Users cancel own unredeemed jobs"
    ON public.print_jobs
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND status IN ('pending_payment', 'awaiting_redemption'))
    WITH CHECK (user_id = auth.uid() AND status = 'voided');

-- OPERATORS: Can ONLY view jobs redeemed at their assigned device
DROP POLICY IF EXISTS "Operators view redeemed jobs for their device" ON public.print_jobs;
CREATE POLICY "Operators view redeemed jobs for their device"
    ON public.print_jobs
    FOR SELECT
    TO authenticated
    USING (
        redeemed_by_device_id IS NOT NULL 
        AND redeemed_by_device_id = public.get_operator_device_id()
    );

-- OPERATORS: Can mark a redeemed job as 'printed' for their assigned device
DROP POLICY IF EXISTS "Operators update printed status for their device" ON public.print_jobs;
CREATE POLICY "Operators update printed status for their device"
    ON public.print_jobs
    FOR UPDATE
    TO authenticated
    USING (
        redeemed_by_device_id IS NOT NULL 
        AND redeemed_by_device_id = public.get_operator_device_id()
    )
    WITH CHECK (
        redeemed_by_device_id = public.get_operator_device_id()
        AND status IN ('redeemed', 'printed')
    );

-- Admins full access on print_jobs
DROP POLICY IF EXISTS "Admins full access on print_jobs" ON public.print_jobs;
CREATE POLICY "Admins full access on print_jobs"
    ON public.print_jobs
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

--------------------------------------------------------------------------------
-- 6. POLICIES: public.otps
-- REQUIREMENT: "otps table should never be readable by end users directly through
-- a general SELECT — only validated through a secure RPC function"
--------------------------------------------------------------------------------

-- Only admins can directly SELECT from otps
DROP POLICY IF EXISTS "Admins can view and manage otps" ON public.otps;
CREATE POLICY "Admins can view and manage otps"
    ON public.otps
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Dedicated secure RPC for a user to fetch the OTP code for their OWN active print job
CREATE OR REPLACE FUNCTION public.get_my_job_otp(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_otp RECORD;
BEGIN
    -- Verify the caller owns the print job
    IF NOT EXISTS (
        SELECT 1 FROM public.print_jobs
        WHERE id = p_job_id AND user_id = auth.uid()
    ) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: You do not own this print job'
            USING ERRCODE = '42501';
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

--------------------------------------------------------------------------------
-- 7. POLICIES: public.payments
--------------------------------------------------------------------------------
-- Customers can view payments for their own jobs
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.id = payments.print_job_id
              AND print_jobs.user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- Operators can view payments for jobs redeemed at their device (to verify cash collection)
DROP POLICY IF EXISTS "Operators view payments for redeemed jobs" ON public.payments;
CREATE POLICY "Operators view payments for redeemed jobs"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.id = payments.print_job_id
              AND print_jobs.redeemed_by_device_id = public.get_operator_device_id()
        )
    );

-- Operators can toggle cash_collected for cash payments at their device
DROP POLICY IF EXISTS "Operators toggle cash collected" ON public.payments;
CREATE POLICY "Operators toggle cash collected"
    ON public.payments
    FOR UPDATE
    TO authenticated
    USING (
        method = 'cash'
        AND EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.id = payments.print_job_id
              AND print_jobs.redeemed_by_device_id = public.get_operator_device_id()
        )
    )
    WITH CHECK (
        method = 'cash'
    );

-- Admins full access on payments
DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments"
    ON public.payments
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

--------------------------------------------------------------------------------
-- 8. POLICIES: public.admin_users
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage admin_users" ON public.admin_users;
CREATE POLICY "Admins manage admin_users"
    ON public.admin_users
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

--------------------------------------------------------------------------------
-- 9. STORAGE POLICIES: 'print-files' BUCKET
--------------------------------------------------------------------------------
-- Users can upload files to the print-files bucket
DROP POLICY IF EXISTS "Authenticated users can upload print files" ON storage.objects;
CREATE POLICY "Authenticated users can upload print files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'print-files');

-- Users can read their own uploaded files
DROP POLICY IF EXISTS "Users can read own uploaded files" ON storage.objects;
CREATE POLICY "Users can read own uploaded files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'print-files' 
        AND (
            auth.uid() = owner
            OR public.is_admin()
        )
    );

-- Operators can read files for print jobs currently redeemed at their device
DROP POLICY IF EXISTS "Operators can download file for redeemed job" ON storage.objects;
CREATE POLICY "Operators can download file for redeemed job"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'print-files'
        AND EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.file_path = storage.objects.name
              AND print_jobs.status = 'redeemed'
              AND print_jobs.redeemed_by_device_id = public.get_operator_device_id()
        )
    );
