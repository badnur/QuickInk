-- Migration 000002: Business Logic, redeem_otp RPC, and Storage Erasure Trigger
-- Enforces business rules:
-- 1. Type B OTP (cash) cannot be redeemed at kiosk terminals (enforced in redeem_otp and trigger).
-- 2. print_jobs.file_path is nulled and storage object deleted upon transitioning to 'printed'.
-- 3. Security definer role helpers for RLS and RPC execution.

--------------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS FOR SECURITY & ROLES
--------------------------------------------------------------------------------

-- Checks if the authenticated user is registered as an admin
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

-- Retrieves the assigned device_id for the current operator
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

--------------------------------------------------------------------------------
-- 2. SECURE OTP REDEMPTION RPC FUNCTION
-- Takes OTP code + device_id, enforces constraints, marks OTP used, updates job status,
-- and returns the print job details to the device.
--------------------------------------------------------------------------------

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

    -- 1. Verify target device exists and is registered
    SELECT id, type, name, status
    INTO v_device
    FROM public.devices
    WHERE id = p_device_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device with ID % not found', p_device_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. Locate OTP record
    SELECT *
    INTO v_otp
    FROM public.otps
    WHERE code = v_clean_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid OTP code'
            USING ERRCODE = 'P0003';
    END IF;

    -- 3. Check if OTP is already used
    IF v_otp.used THEN
        RAISE EXCEPTION 'This OTP has already been redeemed on %', v_otp.used_at
            USING ERRCODE = 'P0004';
    END IF;

    -- 4. Check if OTP has expired
    IF v_otp.expires_at < now() THEN
        RAISE EXCEPTION 'This OTP has expired on %', v_otp.expires_at
            USING ERRCODE = 'P0005';
    END IF;

    -- 5. BUSINESS RULE ENFORCEMENT:
    -- Type A = Online payment -> Valid at both 'shop' AND 'kiosk'
    -- Type B = Cash payment   -> Valid at 'shop' ONLY (rejected at 'kiosk')
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

    -- Check print job status eligibility
    IF v_job.status NOT IN ('awaiting_redemption', 'pending_payment') THEN
        RAISE EXCEPTION 'Print job is not eligible for redemption (current status: %)', v_job.status
            USING ERRCODE = 'P0008';
    END IF;

    -- 7. Atomically mark OTP as used
    UPDATE public.otps
    SET used = true,
        used_at = now(),
        used_by_device_id = p_device_id
    WHERE id = v_otp.id;

    -- 8. Atomically update print job to 'redeemed'
    UPDATE public.print_jobs
    SET status = 'redeemed',
        redeemed_at = now(),
        redeemed_by_device_id = p_device_id
    WHERE id = v_job.id
    RETURNING * INTO v_job;

    -- 9. Return detailed payload for terminal/kiosk execution
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

-- Grant execution to authenticated users and service role (operators and terminals)
GRANT EXECUTE ON FUNCTION public.redeem_otp(TEXT, UUID) TO authenticated, service_role, anon;

--------------------------------------------------------------------------------
-- 3. DEFENSE-IN-DEPTH TRIGGER: PREVENT DIRECT MIS-REDEMPTION OF TYPE B OTPS
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
-- 4. TRIGGER: AUTO-NULL file_path AND DELETE STORAGE OBJECT ON PRINTED
--------------------------------------------------------------------------------

-- BEFORE UPDATE: Nullify file_path and record printed_at
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

-- AFTER UPDATE: Physically remove file from Supabase storage.objects
CREATE OR REPLACE FUNCTION public.handle_job_printed_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
BEGIN
    IF NEW.status = 'printed' AND OLD.status <> 'printed' AND OLD.file_path IS NOT NULL THEN
        BEGIN
            -- Attempt deletion from storage.objects
            DELETE FROM storage.objects
            WHERE bucket_id = 'print-files'
              AND name = OLD.file_path;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log warning, do not block the status change if object was already deleted or storage unavailable
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
