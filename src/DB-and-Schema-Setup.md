-- Database migrations for API integration
-- Run these in your Supabase SQL editor

-- 1. Create API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  app_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_is_active_idx ON public.api_keys (is_active);

-- 2. Add API key tracking to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES public.api_keys(id),
ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS bookings_api_key_id_idx ON public.bookings (api_key_id);

-- 3. Create settings table for host configuration
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_refresh_token TEXT NOT NULL,
  host_email TEXT NOT NULL,
  host_name TEXT,
  email_from TEXT NOT NULL DEFAULT 'noreply@yourdomain.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings (update these values)
INSERT INTO public.settings (google_refresh_token, host_email, host_name, email_from)
VALUES (
  'your_google_refresh_token_here',
  'host@yourdomain.com',
  'Your Name',
  'noreply@yourdomain.com'
) ON CONFLICT DO NOTHING;

-- 4. Create API usage logs table (optional but recommended)
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_logs_api_key_id_idx ON public.api_usage_logs (api_key_id);
CREATE INDEX IF NOT EXISTS api_usage_logs_created_at_idx ON public.api_usage_logs (created_at DESC);

-- 5. Create function to update usage count
CREATE OR REPLACE FUNCTION update_api_key_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.api_keys 
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = NEW.api_key_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to auto-update usage count
DROP TRIGGER IF EXISTS api_usage_trigger ON public.api_usage_logs;
CREATE TRIGGER api_usage_trigger
  AFTER INSERT ON public.api_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_api_key_usage();

-- 7. Add RLS policies (optional - if you enable RLS)
-- Since we're using service role key, RLS is bypassed
-- But you can add policies for additional security layers

-- ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
-- CREATE POLICY "Service role has full access to api_keys"
--   ON public.api_keys
--   FOR ALL
--   TO service_role
--   USING (true)
--   WITH CHECK (true);