CREATE TABLE public.report_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_contacts TO authenticated;
GRANT ALL ON public.report_contacts TO service_role;
ALTER TABLE public.report_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin report contacts" ON public.report_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "report users read contacts" ON public.report_contacts FOR SELECT TO authenticated
  USING (public.can_work_reports(auth.uid()));

ALTER TABLE public.profiles ADD COLUMN can_request_edit boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_reports ADD COLUMN edit_requested boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_reports ADD COLUMN edit_used boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.request_report_edit(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND can_request_edit AND can_work_reports) THEN
    RAISE EXCEPTION 'No tienes permiso para pedir modificaciones';
  END IF;
  UPDATE public.work_reports SET edit_requested = true
   WHERE id = _id AND user_id = auth.uid() AND closed AND NOT edit_used;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este parte ya no admite solicitudes de modificación'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.request_report_edit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_report_edit(uuid) TO authenticated;