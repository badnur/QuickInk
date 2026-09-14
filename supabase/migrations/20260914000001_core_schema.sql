-- Migration 000001: QuickInk Core Schema
-- Creates all base tables, enums, triggers for auth sync, and performance indexes.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--------------------------------------------------------------------------------
-- 1. ENUMS & DOMAINS
--------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE device_type AS ENUM ('shop', 'kiosk');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE device_status AS ENUM ('online', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM (
        'pending_payment',
        'awaiting_redemption',
        'redeemed',
        'printed',
        'expired',
        'voided'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('online', 'cash');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE otp_type AS ENUM ('type_a', 'type_b');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM ('admin', 'superadmin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

--------------------------------------------------------------------------------
-- 2. USERS (End Customers)
--------------------------------------------------------------------------------
-- Clean up any legacy conflicting mock tables
DROP TABLE IF EXISTS public.otps CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.print_jobs CASCADE;
DROP TABLE IF EXISTS public.operators CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to automatically create a public.users record when a new user signs up in auth.users
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

--------------------------------------------------------------------------------
-- 3. DEVICES (Shop Terminals & Kiosks)
--------------------------------------------------------------------------------
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

-- Auto-update updated_at timestamp on devices
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

--------------------------------------------------------------------------------
-- 4. OPERATORS (Shopkeeper & Kiosk Operator Accounts)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operators (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 5. PRINT JOBS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    file_path TEXT, -- Supabase Storage path in 'print-files' bucket; cleared when printed/expired
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

--------------------------------------------------------------------------------
-- 6. OTPS (Redemption Codes)
-- Type A: Online payment (Valid at both shop and kiosk)
-- Type B: Cash payment (Valid at shop ONLY)
--------------------------------------------------------------------------------
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

--------------------------------------------------------------------------------
-- 7. PAYMENTS
--------------------------------------------------------------------------------
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

--------------------------------------------------------------------------------
-- 8. ADMIN USERS (Management / Monitoring Accounts)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role admin_role NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 9. PERFORMANCE & LOOKUP INDEXES
--------------------------------------------------------------------------------
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
