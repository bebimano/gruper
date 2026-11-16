-- Migration 0010: per-user part numbers
-- Each user gets their own sequential number starting at 1.
-- user_number is set automatically via trigger on insert.

ALTER TABLE public.work_reports ADD COLUMN IF NOT EXISTS user_number integer;

-- Function that computes the next number for the inserting user
CREATE OR REPLACE FUNCTION public.set_user_report_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  IF NEW.user_number IS NULL THEN
    SELECT COALESCE(MAX(user_number), 0) + 1
      INTO NEW.user_number
      FROM public.work_reports
     WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_report_number ON public.work_reports;

CREATE TRIGGER trg_user_report_number
  BEFORE INSERT ON public.work_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_user_report_number();

-- Back-fill existing rows so they also have a user_number
-- (assigns numbers ordered by created_at within each user)
WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
    FROM public.work_reports
   WHERE user_number IS NULL
)
UPDATE public.work_reports wr
   SET user_number = ranked.rn
  FROM ranked
 WHERE wr.id = ranked.id;
