-- Migration: Full Page Range Support & RLS Update Policy
-- Allows print jobs to store and update page_range, and ensures anon/authenticated update access

-- 1. Ensure page_range column exists on public.print_jobs
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
      'Page range string (e.g. "2-2", "1-3,5"). NULL = all pages.';
  END IF;
END;
$$;

-- 2. Allow update on print_jobs for anon and authenticated (required for page_range & status)
DROP POLICY IF EXISTS "Allow anon update print jobs" ON public.print_jobs;
CREATE POLICY "Allow anon update print jobs"
ON public.print_jobs FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 3. Update create_print_job function signature to optionally accept page_range
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
    v_user_id UUID;
    v_clean_file_path TEXT;
    v_page_range TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF lower(p_payment_type) = 'cash' THEN
        v_otp_type := 'type_b';
    ELSE
        v_otp_type := 'type_a';
    END IF;

    v_expires_at := now() + INTERVAL '60 minutes';

    -- Extract page_range if embedded in file_path (#range=...)
    v_clean_file_path := p_file_path;
    v_page_range := NULL;
    IF p_file_path LIKE '%#range=%' THEN
        v_clean_file_path := split_part(p_file_path, '#range=', 1);
        v_page_range := split_part(p_file_path, '#range=', 2);
    END IF;

    -- Generate random 6-digit numerical unique code (100000 - 999999)
    LOOP
        v_otp_code := lpad(floor(random() * 900000 + 100000)::INTEGER::TEXT, 6, '0');
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
        page_range,
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
        v_page_range,
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
        'message', 'Print job created successfully',
        'order', jsonb_build_object(
            'id', v_job_id,
            'file_path', p_file_path,
            'file_type', lower(p_file_type),
            'copies', GREATEST(1, p_copies),
            'color_mode', lower(p_color_mode),
            'duplex', COALESCE(p_duplex, false),
            'page_count', GREATEST(1, p_page_count),
            'page_range', v_page_range,
            'payment_type', lower(p_payment_type),
            'status', 'awaiting_redemption',
            'expires_at', v_expires_at
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
