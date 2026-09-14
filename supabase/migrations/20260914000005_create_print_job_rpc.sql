-- Migration 000005: create_print_job RPC & Guest Checkout Support
-- Adds atomic create_print_job function and policies to support web app order creation.

--------------------------------------------------------------------------------
-- 1. SECURE ATOMIC ORDER CREATION RPC
--------------------------------------------------------------------------------

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

    -- Generate random 6-character unique code starting with QK
    LOOP
        v_otp_code := 'QK';
        FOR v_i IN 1..4 LOOP
            v_otp_code := v_otp_code || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
        END LOOP;

        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.otps WHERE code = v_otp_code AND used = false);
    END LOOP;

    -- 1. Insert print_jobs
    INSERT INTO public.print_jobs (
        user_id,
        file_path,
        file_type,
        copies,
        color_mode,
        duplex,
        page_count,
        status,
        payment_type,
        expires_at
    ) VALUES (
        v_user_id,
        p_file_path,
        lower(p_file_type),
        GREATEST(1, p_copies),
        lower(p_color_mode),
        COALESCE(p_duplex, false),
        GREATEST(1, p_page_count),
        'awaiting_redemption',
        lower(p_payment_type)::payment_type,
        v_expires_at
    )
    RETURNING id INTO v_job_id;

    -- 2. Insert otps
    INSERT INTO public.otps (
        print_job_id,
        code,
        otp_type,
        used,
        expires_at
    ) VALUES (
        v_job_id,
        v_otp_code,
        v_otp_type,
        false,
        v_expires_at
    );

    -- 3. Insert payments
    INSERT INTO public.payments (
        print_job_id,
        amount,
        method,
        gateway_reference,
        status,
        cash_collected
    ) VALUES (
        v_job_id,
        COALESCE(p_amount, 0),
        lower(p_payment_type)::payment_type,
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

--------------------------------------------------------------------------------
-- 2. GUEST CHECKOUT POLICIES
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public insert of print jobs" ON public.print_jobs;
CREATE POLICY "Allow public insert of print jobs"
    ON public.print_jobs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert of payments" ON public.payments;
CREATE POLICY "Allow public insert of payments"
    ON public.payments
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
