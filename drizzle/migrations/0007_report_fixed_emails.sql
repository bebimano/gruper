CREATE TABLE public.report_fixed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_fixed_emails TO authenticated;
GRANT ALL ON public.report_fixed_emails TO service_role;
ALTER TABLE public.report_fixed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin fixed emails" ON public.report_fixed_emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "report users read fixed emails" ON public.report_fixed_emails FOR SELECT TO authenticated
  USING (public.can_work_reports(auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_reports;