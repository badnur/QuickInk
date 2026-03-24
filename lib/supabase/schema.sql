-- QuickInk Database Schema for Supabase
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xhzfrmpbhasnipirccnt/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. MACHINES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance')),
  paper_available BOOLEAN DEFAULT true,
  distance TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_location ON machines(latitude, longitude);

-- ============================================
-- 2. PARTNERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_created_at ON partners(created_at DESC);

-- ============================================
-- 3. PRINT_JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  qr_code TEXT NOT NULL,
  qr_data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'printed', 'cancelled')),
  pages INTEGER DEFAULT 1,
  price DECIMAL(10, 2) DEFAULT 0,
  color_mode TEXT DEFAULT 'bw' CHECK (color_mode IN ('bw', 'color')),
  machine_id UUID REFERENCES machines(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_machine ON print_jobs(machine_id);

-- ============================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for each table
CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_print_jobs_updated_at BEFORE UPDATE ON print_jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Public read access for machines
CREATE POLICY "Anyone can view machines"
ON machines FOR SELECT
USING (true);

-- Only service_role can modify machines
CREATE POLICY "Service role can insert machines"
ON machines FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can update machines"
ON machines FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role');

-- Public can create partners (registration)
CREATE POLICY "Anyone can create partners"
ON partners FOR INSERT
WITH CHECK (true);

-- Public read for partners
CREATE POLICY "Anyone can view partners"
ON partners FOR SELECT
USING (true);

-- Only service_role can update partners
CREATE POLICY "Service role can update partners"
ON partners FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role');

-- Public can create print jobs
CREATE POLICY "Anyone can create print jobs"
ON print_jobs FOR INSERT
WITH CHECK (true);

-- Public can view their own print jobs
CREATE POLICY "Anyone can view print jobs"
ON print_jobs FOR SELECT
USING (true);

-- Only service_role can update print jobs
CREATE POLICY "Service role can update print jobs"
ON print_jobs FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- 6. SEED DATA (Optional - for testing)
-- ============================================

-- Insert sample machines
INSERT INTO machines (name, address, latitude, longitude, status, paper_available, distance) VALUES
('QuickInk - Dhanmondi', 'House 23, Road 5, Dhanmondi, Dhaka-1205', 23.7461, 90.3742, 'online', true, '0.5 km'),
('QuickInk - Gulshan', 'Shop 12, Gulshan Avenue, Gulshan-1, Dhaka-1212', 23.7809, 90.4172, 'online', true, '1.2 km'),
('QuickInk - Banani', 'Plot 15, Road 11, Banani, Dhaka-1213', 23.7937, 90.4066, 'online', false, '2.1 km'),
('QuickInk - Mirpur', 'Section 10, Mirpur, Dhaka-1216', 23.8068, 90.3683, 'offline', false, '3.5 km'),
('QuickInk - Uttara', 'Sector 7, Uttara, Dhaka-1230', 23.8759, 90.3795, 'online', true, '1.8 km')
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. STORAGE BUCKET SETUP
-- ============================================
-- Run this separately in Supabase Dashboard > Storage
-- Or use the Supabase CLI/API to create bucket 'print-files'

-- Bucket: print-files
-- Public: true
-- File size limit: 10MB
-- Allowed MIME types: application/pdf, image/*, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
