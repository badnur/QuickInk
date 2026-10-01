-- ============================================================================
-- MIGRATION 011: PARTNER CREDIT SUBSCRIPTION & SAFE PRINT DEDUCTION
-- Implements wholesale credit model: 1 credit = 1 Taka of customer print value.
-- Welcome Bonus: 10,000 free credits upon admin approval.
-- Safe Print Rule: Credits are ONLY deducted on physical print confirmation.
-- Zero deductions on hardware/spooler errors or paper jams after OTP redemption.
-- ============================================================================

-- 1. Add credits_balance column to public.devices (default 0)
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS credits_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_devices_credits_balance ON public.devices(credits_balance);

-- 2. Create partner_credit_transactions table for full audit log
CREATE TABLE IF NOT EXISTS public.partner_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL, -- positive for credits added, negative for print deductions
    balance_after NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    type TEXT NOT NULL CHECK (type IN ('welcome_bonus', 'subscription_topup', 'print_deduction', 'admin_adjustment', 'refund')),
    description TEXT NOT NULL,
    print_job_id UUID REFERENCES public.print_jobs(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_device ON public.partner_credit_transactions(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_job ON public.partner_credit_transactions(print_job_id);

-- Enable RLS on partner_credit_transactions
ALTER TABLE public.partner_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and partners can view device transactions" ON public.partner_credit_transactions;
CREATE POLICY "Public and partners can view device transactions" ON public.partner_credit_transactions
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins manage credit transactions" ON public.partner_credit_transactions;
CREATE POLICY "Admins manage credit transactions" ON public.partner_credit_transactions
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Seed / Initialize existing online devices with 10,000 welcome credits if balance is 0
UPDATE public.devices
SET credits_balance = 10000.00
WHERE credits_balance = 0 AND (status = 'online' OR location->>'partner_status' = 'approved');

-- 4. RPC Function: Atomically complete print job and deduct credits based on dynamic area pricing
CREATE OR REPLACE FUNCTION public.confirm_print_and_deduct_credits(
    p_job_id UUID,
    p_device_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    -- 1. Lock and fetch device
    SELECT *
    INTO v_device
    FROM public.devices
    WHERE id = p_device_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Lock and fetch print job
    SELECT *
    INTO v_job
    FROM public.print_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Print job not found' USING ERRCODE = 'P0007';
    END IF;

    -- If job already completed, return existing status idempotently
    IF v_job.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_completed', true,
            'credits_deducted', 0,
            'balance', v_device.credits_balance,
            'message', 'Job was already confirmed and completed'
        );
    END IF;

    -- 3. Resolve active dynamic pricing tier for this device
    SELECT pt.id, pt.name, pt.bw_price, pt.color_price
    INTO v_tier
    FROM public.devices d
    LEFT JOIN public.pricing_tiers pt ON pt.id = d.pricing_tier_id
    WHERE d.id = p_device_id;

    IF NOT FOUND OR v_tier.id IS NULL THEN
        -- Fallback to default tier
        SELECT id, name, bw_price, color_price
        INTO v_tier
        FROM public.pricing_tiers
        WHERE is_default = true
        LIMIT 1;
    END IF;

    -- Determine unit price
    v_is_color := (v_job.color_mode = 'color');
    v_unit_price := CASE 
        WHEN v_is_color THEN COALESCE(v_tier.color_price, 8.00)
        ELSE COALESCE(v_tier.bw_price, 2.00)
    END;

    v_copies := COALESCE(v_job.copies, 1);
    v_page_count := COALESCE(v_job.page_count, 1);

    -- 1 credit = 1 Taka of customer print value
    v_credit_cost := ROUND(v_unit_price * v_page_count * v_copies, 2);

    -- 4. Calculate new balance (Allow grace margin down to 0; if balance < cost, still record or cap)
    v_new_balance := GREATEST(0.00, v_device.credits_balance - v_credit_cost);

    -- 5. Update device credit balance
    UPDATE public.devices
    SET credits_balance = v_new_balance,
        location = jsonb_set(
            COALESCE(location, '{}'::jsonb),
            '{credits_balance}',
            to_jsonb(v_new_balance)
        ),
        updated_at = now()
    WHERE id = p_device_id;

    -- 6. Update print job status to completed
    UPDATE public.print_jobs
    SET status = 'completed',
        printed_at = now(),
        redeemed_by_device_id = p_device_id
    WHERE id = p_job_id;

    -- 7. Record transaction audit log
    INSERT INTO public.partner_credit_transactions (
        device_id,
        amount,
        balance_after,
        type,
        description,
        print_job_id,
        metadata
    ) VALUES (
        p_device_id,
        -v_credit_cost,
        v_new_balance,
        'print_deduction',
        format('Print Job Completed: %s sheet(s) %s × %s copy @ ৳%s/sheet', 
            v_page_count, 
            CASE WHEN v_is_color THEN 'Color' ELSE 'B&W' END, 
            v_copies, 
            v_unit_price
        ),
        p_job_id,
        jsonb_build_object(
            'page_count', v_page_count,
            'copies', v_copies,
            'color_mode', v_job.color_mode,
            'unit_price', v_unit_price,
            'tier_name', COALESCE(v_tier.name, 'Standard')
        )
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

-- 5. RPC Function: Top up device credits (Welcome bonus, subscription package, or admin grant)
CREATE OR REPLACE FUNCTION public.topup_device_credits(
    p_device_id UUID,
    p_amount NUMERIC,
    p_type TEXT DEFAULT 'subscription_topup',
    p_description TEXT DEFAULT 'Partner Credit Top-up'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_device RECORD;
    v_new_balance NUMERIC(12, 2);
BEGIN
    SELECT *
    INTO v_device
    FROM public.devices
    WHERE id = p_device_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found' USING ERRCODE = 'P0002';
    END IF;

    v_new_balance := v_device.credits_balance + p_amount;

    UPDATE public.devices
    SET credits_balance = v_new_balance,
        location = jsonb_set(
            COALESCE(location, '{}'::jsonb),
            '{credits_balance}',
            to_jsonb(v_new_balance)
        ),
        updated_at = now()
    WHERE id = p_device_id;

    INSERT INTO public.partner_credit_transactions (
        device_id,
        amount,
        balance_after,
        type,
        description
    ) VALUES (
        p_device_id,
        p_amount,
        v_new_balance,
        p_type,
        p_description
    );

    RETURN jsonb_build_object(
        'success', true,
        'amount_added', p_amount,
        'previous_balance', v_device.credits_balance,
        'balance', v_new_balance,
        'message', format('Added %s credits successfully.', p_amount)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.topup_device_credits(UUID, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
