CREATE TABLE public.machine_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.machine_opens TO authenticated;
GRANT ALL ON public.machine_opens TO service_role;
ALTER TABLE public.machine_opens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read opens" ON public.machine_opens FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "log own opens" ON public.machine_opens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_id));
CREATE INDEX machine_opens_opened_idx ON public.machine_opens (opened_at DESC);