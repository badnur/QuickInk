-- ============================================================================
-- MIGRATION 009: ZONE/TIER-BASED PRICING (Model 2)
-- Adds pricing_tiers table, links devices to a tier, seeds default tiers.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/sql/new
-- ============================================================================

-- 1. Create pricing_tiers table
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

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS trg_pricing_tiers_updated_at ON public.pricing_tiers;
CREATE TRIGGER trg_pricing_tiers_updated_at
    BEFORE UPDATE ON public.pricing_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 2. Enforce at most one default tier
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_tiers_single_default
    ON public.pricing_tiers (is_default)
    WHERE is_default = true;

-- 3. Add pricing_tier_id FK to devices (nullable — NULL = use platform default)
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS pricing_tier_id UUID REFERENCES public.pricing_tiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_pricing_tier_id ON public.devices(pricing_tier_id);

-- 4. Seed default pricing tiers
-- Standard tier is the platform default (matches current hardcoded prices)
INSERT INTO public.pricing_tiers (id, name, description, bw_price, color_price, is_default)
VALUES
    (
        'aaaaaaaa-0000-0000-0000-000000000001',
        'Standard',
        'Default platform rate for general partner shops and kiosks.',
        2.00,
        8.00,
        true
    ),
    (
        'aaaaaaaa-0000-0000-0000-000000000002',
        'Campus',
        'Discounted rate for university campuses and student hubs.',
        1.50,
        6.00,
        false
    ),
    (
        'aaaaaaaa-0000-0000-0000-000000000003',
        'Commercial',
        'Premium rate for high-footfall commercial zones and malls.',
        3.00,
        10.00,
        false
    )
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    bw_price = EXCLUDED.bw_price,
    color_price = EXCLUDED.color_price,
    is_default = EXCLUDED.is_default,
    updated_at = now();

-- 5. Assign existing seed devices to the Standard tier
UPDATE public.devices
SET pricing_tier_id = 'aaaaaaaa-0000-0000-0000-000000000001'
WHERE pricing_tier_id IS NULL;

-- 6. RLS Policies on pricing_tiers
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read pricing tiers (needed for user-facing price display)
DROP POLICY IF EXISTS "Public read pricing tiers" ON public.pricing_tiers;
CREATE POLICY "Public read pricing tiers" ON public.pricing_tiers
    FOR SELECT TO anon, authenticated
    USING (true);

-- Only admins can create / update / delete tiers
DROP POLICY IF EXISTS "Admins manage pricing tiers" ON public.pricing_tiers;
CREATE POLICY "Admins manage pricing tiers" ON public.pricing_tiers
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Helper RPC: get the effective pricing for a device (falls back to default tier)
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
    -- Try to get the device's assigned tier
    SELECT pt.id, pt.name, pt.bw_price, pt.color_price
    INTO v_tier
    FROM public.devices d
    LEFT JOIN public.pricing_tiers pt ON pt.id = d.pricing_tier_id
    WHERE d.id = p_device_id;

    -- If device has no tier assigned, fall back to the platform default tier
    IF NOT FOUND OR v_tier.id IS NULL THEN
        SELECT id, name, bw_price, color_price
        INTO v_tier
        FROM public.pricing_tiers
        WHERE is_default = true
        LIMIT 1;
    END IF;

    -- Final fallback: hardcoded Standard prices if no default tier seeded
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'tier_id', null,
            'tier_name', 'Standard',
            'bw_price', 2.00,
            'color_price', 8.00
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
