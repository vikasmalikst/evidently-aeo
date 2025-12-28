ALTER TABLE public.collector_results
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS status_log jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collector_results_status_check'
  ) THEN
    ALTER TABLE public.collector_results
      ADD CONSTRAINT collector_results_status_check
      CHECK (status IN ('pending', 'running', 'completed', 'failed_retry', 'failed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_collector_results_brand_customer_status_created_at
  ON public.collector_results (brand_id, customer_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.collector_results_status_guard_and_log()
RETURNS trigger AS $$
DECLARE
  allowed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := COALESCE(NEW.status, 'pending');
    NEW.status_log := COALESCE(NEW.status_log, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'from', NULL,
        'to', NEW.status,
        'at', NOW()
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      allowed := false;

      IF OLD.status IS NULL THEN
        allowed := NEW.status IN ('pending', 'running', 'completed', 'failed_retry', 'failed');
      ELSIF OLD.status = 'pending' THEN
        allowed := NEW.status IN ('running', 'completed', 'failed_retry', 'failed', 'pending');
      ELSIF OLD.status = 'running' THEN
        allowed := NEW.status IN ('completed', 'failed_retry', 'failed', 'running');
      ELSIF OLD.status = 'failed_retry' THEN
        allowed := NEW.status IN ('pending', 'running', 'completed', 'failed_retry', 'failed');
      ELSIF OLD.status = 'completed' THEN
        allowed := NEW.status = 'completed';
      ELSIF OLD.status = 'failed' THEN
        allowed := NEW.status = 'failed';
      END IF;

      IF NOT allowed THEN
        RAISE EXCEPTION 'Invalid collector_results status transition: % -> %', OLD.status, NEW.status;
      END IF;

      NEW.status_log := COALESCE(OLD.status_log, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'from', OLD.status,
          'to', NEW.status,
          'at', NOW()
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_collector_results_status_guard_and_log ON public.collector_results;

CREATE TRIGGER trg_collector_results_status_guard_and_log
BEFORE INSERT OR UPDATE OF status ON public.collector_results
FOR EACH ROW
EXECUTE FUNCTION public.collector_results_status_guard_and_log();
