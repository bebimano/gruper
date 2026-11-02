CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL DEFAULT '',
  descripcion text NOT NULL DEFAULT '',
  stock text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin materials" ON public.materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "report users read materials" ON public.materials FOR SELECT TO authenticated
  USING (public.can_work_reports(auth.uid()));

CREATE TABLE public.material_source (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  kind text NOT NULL DEFAULT 'file',
  name text NOT NULL DEFAULT '',
  url text,
  synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_source TO authenticated;
GRANT ALL ON public.material_source TO service_role;
ALTER TABLE public.material_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin material source" ON public.material_source FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));