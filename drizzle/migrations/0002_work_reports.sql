ALTER TABLE public.profiles ADD COLUMN can_work_reports boolean NOT NULL DEFAULT false;
GRANT UPDATE ON public.profiles TO authenticated;
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.can_work_reports(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND can_work_reports)
      OR public.has_role(_user_id, 'admin')
$$;

CREATE TABLE public.work_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number serial NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_reports TO authenticated;
GRANT USAGE ON SEQUENCE public.work_reports_number_seq TO authenticated;
GRANT ALL ON public.work_reports TO service_role;
ALTER TABLE public.work_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports" ON public.work_reports FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.can_work_reports(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.can_work_reports(auth.uid()));
CREATE POLICY "admin reports" ON public.work_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));