-- Migration 000007: Seed Default Devices, Auto-Provisioning & Desktop App Support

-- 1. Seed default demo devices
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

-- 2. Enhance redeem_otp to auto-provision device if not found
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
        RAISE EXCEPTION 'Invalid OTP code. Please verify the 6-digit number.'
            USING ERRCODE = 'P0003';
    END IF;

    -- 2. Verify target device exists, or auto-provision standard default device
    SELECT id, type, name, status
    INTO v_device
    FROM public.devices
    WHERE id = p_device_id;

    IF NOT FOUND THEN
        INSERT INTO public.devices (id, type, name, status)
        VALUES (p_device_id, 'shop', 'QuickInk Station Terminal', 'online')
        ON CONFLICT (id) DO NOTHING;

        SELECT id, type, name, status
        INTO v_device
        FROM public.devices
        WHERE id = p_device_id;
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
