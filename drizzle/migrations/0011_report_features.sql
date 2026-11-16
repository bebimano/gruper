-- Migration 0011: Permission to view all reports & report open tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_view_all_reports boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.report_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  report_id uuid NOT NULL REFERENCES public.work_reports(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.report_opens TO authenticated;
GRANT ALL ON public.report_opens TO service_role;
ALTER TABLE public.report_opens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin read report opens' AND tablename = 'report_opens') THEN
    CREATE POLICY "admin read report opens" ON public.report_opens FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'log own report opens' AND tablename = 'report_opens') THEN
    CREATE POLICY "log own report opens" ON public.report_opens FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS report_opens_opened_idx ON public.report_opens (opened_at DESC);
