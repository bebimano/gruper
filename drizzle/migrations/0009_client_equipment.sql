-- Table: client_equipment
-- Stores client addresses and their equipment (machines) with type, model and serial number.
-- Linked by client name (same as report_contacts.name).

CREATE TABLE public.client_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  direccion text NOT NULL DEFAULT '',
  poblacion text NOT NULL DEFAULT '',
  tipo_maquina text NOT NULL DEFAULT '',   -- e.g. "Depuradora", "Cámara de ozono"
  modelo text NOT NULL DEFAULT '',
  num_serie text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_equipment TO authenticated;
GRANT ALL ON public.client_equipment TO service_role;
ALTER TABLE public.client_equipment ENABLE ROW LEVEL SECURITY;

-- Only admins can manage; users with report access can read (to auto-fill in reports).
CREATE POLICY "admin client equipment" ON public.client_equipment FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "report users read equipment" ON public.client_equipment FOR SELECT TO authenticated
  USING (public.can_work_reports(auth.uid()));
