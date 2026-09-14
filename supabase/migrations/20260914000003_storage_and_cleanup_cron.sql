-- Migration 000003: Supabase Storage Bucket Setup & Scheduled Expiry Cleanup
-- Sets up the 'print-files' private bucket and implements automated cleanup for expired unredeemed jobs.

--------------------------------------------------------------------------------
-- 1. STORAGE BUCKET CONFIGURATION
--------------------------------------------------------------------------------

-- Ensure storage schema exists and register private 'print-files' bucket
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'print-files',
        'print-files',
        false, -- Private: accessed only through signed URLs or authenticated RLS
        52428800, -- 50MB maximum file size
        ARRAY[
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 52428800,
        allowed_mime_types = EXCLUDED.allowed_mime_types;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'storage.buckets table does not exist in local context; skipping bucket insertion';
END $$;

--------------------------------------------------------------------------------
-- 2. CLEANUP FUNCTION FOR EXPIRED PRINT JOBS
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_expired_print_jobs()
RETURNS TABLE (
    expired_jobs_count INTEGER,
    storage_files_deleted INTEGER,
    otps_invalidated INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
    v_job RECORD;
    v_jobs_count INTEGER := 0;
    v_files_count INTEGER := 0;
    v_otps_count INTEGER := 0;
BEGIN
    -- Loop through all eligible expired jobs (not yet redeemed, printed, or voided)
    FOR v_job IN
        SELECT id, file_path
        FROM public.print_jobs
        WHERE expires_at < now()
          AND status IN ('pending_payment', 'awaiting_redemption')
        FOR UPDATE
    LOOP
        -- 1. Remove storage object if a file is attached
        IF v_job.file_path IS NOT NULL THEN
            BEGIN
                DELETE FROM storage.objects
                WHERE bucket_id = 'print-files'
                  AND name = v_job.file_path;
                v_files_count := v_files_count + 1;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Ignore storage deletion errors to ensure status transition completes
                    NULL;
            END;
        END IF;

        -- 2. Invalidate all associated active OTPs
        WITH invalidated AS (
            UPDATE public.otps
            SET used = true,
                used_at = now()
            WHERE print_job_id = v_job.id
              AND used = false
            RETURNING id
        )
        SELECT v_otps_count + count(*)::INTEGER INTO v_otps_count FROM invalidated;

        -- 3. Mark the job as expired and nullify file path
        UPDATE public.print_jobs
        SET status = 'expired',
            file_path = NULL
        WHERE id = v_job.id;

        v_jobs_count := v_jobs_count + 1;
    END LOOP;

    RETURN QUERY SELECT v_jobs_count, v_files_count, v_otps_count;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_print_jobs() TO service_role, postgres;

--------------------------------------------------------------------------------
-- 3. PG_CRON SCHEDULE CONFIGURATION
-- Runs every 10 minutes to clean up expired jobs and purge residual files.
--------------------------------------------------------------------------------

DO $cron_setup$
BEGIN
    -- Attempt enabling pg_cron extension in extensions schema
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

    IF EXISTS (
        SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
        WHERE pg_proc.proname = 'schedule' AND pg_namespace.nspname = 'cron'
    ) THEN
        BEGIN
            EXECUTE 'SELECT cron.unschedule(''quickink_cleanup_expired_jobs'')';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Schedule cleanup job to run every 10 minutes
        EXECUTE 'SELECT cron.schedule(''quickink_cleanup_expired_jobs'', ''*/10 * * * *'', $cmd$SELECT * FROM public.cleanup_expired_print_jobs();$cmd$)';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron not enabled or restricted by platform tier. Scheduled cleanup function public.cleanup_expired_print_jobs() can also be invoked via an Edge Function cron.';
END $cron_setup$;
