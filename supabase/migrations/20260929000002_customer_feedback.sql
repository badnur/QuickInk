-- Migration: Customer Feedbacks Table
CREATE TABLE IF NOT EXISTS public.customer_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  otp_code TEXT,
  device_id UUID,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  tags TEXT[] DEFAULT '{}',
  message TEXT,
  user_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.customer_feedbacks ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public/customer) to submit feedback
CREATE POLICY "Allow public insert to customer_feedbacks"
  ON public.customer_feedbacks
  FOR INSERT
  WITH CHECK (true);

-- Allow reading feedbacks (for admin portal and summary)
CREATE POLICY "Allow read customer_feedbacks"
  ON public.customer_feedbacks
  FOR SELECT
  USING (true);

-- Indexes for fast query and analytics
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_created_at ON public.customer_feedbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_rating ON public.customer_feedbacks(rating);
CREATE INDEX IF NOT EXISTS idx_customer_feedbacks_job_id ON public.customer_feedbacks(job_id);
