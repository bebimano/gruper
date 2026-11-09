CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  client text NOT NULL DEFAULT '',
  assigned_to uuid,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','en_curso','pausado','terminado')),
  status_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin jobs" ON public.jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "assignee reads jobs" ON public.jobs FOR SELECT TO authenticated USING (assigned_to = auth.uid());

CREATE OR REPLACE FUNCTION public.set_job_status(_id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('pendiente','en_curso','pausado','terminado') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
  UPDATE public.jobs SET status = _status, status_note = coalesce(_note,''), updated_at = now()
  WHERE id = _id AND (assigned_to = auth.uid() OR public.has_role(auth.uid(),'admin'));
  IF NOT FOUND THEN RAISE EXCEPTION 'No autorizado'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_job_status(uuid,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_job_status(uuid,text,text) TO authenticated;

CREATE TABLE public.notification_settings (
  event text PRIMARY KEY CHECK (event IN ('new_report','new_job','job_status')),
  enabled boolean NOT NULL DEFAULT true,
  recipients uuid[] NOT NULL DEFAULT '{}'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin notification settings" ON public.notification_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  platform text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push tokens" ON public.push_tokens FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;