-- Supabase Seed Data for QuickInk
-- Provides sample devices (1 shop, 1 kiosk), sample operator, and test print jobs with OTPs for local testing.

--------------------------------------------------------------------------------
-- 1. SEED SAMPLE DEVICES
--------------------------------------------------------------------------------

-- Device 1: Partner Print Shop
INSERT INTO public.devices (
    id,
    type,
    name,
    location,
    status
) VALUES (
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
INSERT INTO public.devices (
    id,
    type,
    name,
    location,
    status
) VALUES (
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

--------------------------------------------------------------------------------
-- 2. SEED SAMPLE OPERATOR ACCOUNT (For Local Testing)
--------------------------------------------------------------------------------

DO $$
DECLARE
    v_operator_auth_id UUID := '33333333-3333-3333-3333-333333333333';
BEGIN
    -- Check if auth.users table exists (e.g. in Supabase environment)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud
        ) VALUES (
            v_operator_auth_id,
            '00000000-0000-0000-0000-000000000000',
            'shopkeeper@quickink.test',
            crypt('password123', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Dhanmondi Shopkeeper"}'::jsonb,
            now(),
            now(),
            'authenticated',
            'authenticated'
        )
        ON CONFLICT (id) DO NOTHING;

        -- Create operator profile assigned to Dhanmondi Partner Shop
        INSERT INTO public.operators (
            id,
            device_id,
            role
        ) VALUES (
            v_operator_auth_id,
            '11111111-1111-1111-1111-111111111111',
            'shopkeeper'
        )
        ON CONFLICT (id) DO UPDATE SET
            device_id = EXCLUDED.device_id,
            role = EXCLUDED.role;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not seed auth.users directly. Skipping operator auth user.';
END $$;

--------------------------------------------------------------------------------
-- 3. SEED SAMPLE PRINT JOBS & OTPS
--------------------------------------------------------------------------------

-- Job 1: Online Paid Job (Type A OTP) - VALID at both Shop AND Kiosk
INSERT INTO public.print_jobs (
    id,
    file_path,
    file_type,
    copies,
    color_mode,
    duplex,
    page_count,
    status,
    payment_type,
    created_at,
    expires_at
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'sample-docs/university_assignment.pdf',
    'pdf',
    2,
    'bw',
    false,
    5,
    'awaiting_redemption',
    'online',
    now(),
    now() + INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

-- Payment for Job 1
INSERT INTO public.payments (
    id,
    print_job_id,
    amount,
    method,
    gateway_reference,
    status,
    cash_collected
) VALUES (
    '44444444-0000-0000-0000-000000000001',
    '44444444-4444-4444-4444-444444444444',
    20.00,
    'online',
    'bkash_tx_998822',
    'completed',
    false
)
ON CONFLICT (id) DO NOTHING;

-- OTP for Job 1 (Type A)
INSERT INTO public.otps (
    id,
    print_job_id,
    code,
    otp_type,
    used,
    expires_at
) VALUES (
    '44444444-0000-0000-0000-000000000002',
    '44444444-4444-4444-4444-444444444444',
    'QK1001',
    'type_a',
    false,
    now() + INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;


-- Job 2: Cash Payment Job (Type B OTP) - VALID at Shop ONLY (Rejected at Kiosk)
INSERT INTO public.print_jobs (
    id,
    file_path,
    file_type,
    copies,
    color_mode,
    duplex,
    page_count,
    status,
    payment_type,
    created_at,
    expires_at
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'sample-docs/tax_return_form.pdf',
    'pdf',
    1,
    'color',
    true,
    8,
    'awaiting_redemption',
    'cash',
    now(),
    now() + INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

-- Payment for Job 2
INSERT INTO public.payments (
    id,
    print_job_id,
    amount,
    method,
    gateway_reference,
    status,
    cash_collected
) VALUES (
    '55555555-0000-0000-0000-000000000001',
    '55555555-5555-5555-5555-555555555555',
    64.00,
    'cash',
    NULL,
    'pending',
    false
)
ON CONFLICT (id) DO NOTHING;

-- OTP for Job 2 (Type B)
INSERT INTO public.otps (
    id,
    print_job_id,
    code,
    otp_type,
    used,
    expires_at
) VALUES (
    '55555555-0000-0000-0000-000000000002',
    '55555555-5555-5555-5555-555555555555',
    'QK2002',
    'type_b',
    false,
    now() + INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- 4. VERIFICATION TEST COMMANDS
--------------------------------------------------------------------------------
-- Test 1: Redeem Type A OTP (QK1001) at Kiosk (should SUCCEED):
-- SELECT public.redeem_otp('QK1001', '22222222-2222-2222-2222-222222222222');
--
-- Test 2: Redeem Type B OTP (QK2002) at Kiosk (should FAIL with error P0006):
-- SELECT public.redeem_otp('QK2002', '22222222-2222-2222-2222-222222222222');
--
-- Test 3: Redeem Type B OTP (QK2002) at Shop (should SUCCEED):
-- SELECT public.redeem_otp('QK2002', '11111111-1111-1111-1111-111111111111');
