CREATE TABLE public.contact_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
 company text NOT NULL CHECK (char_length(btrim(company)) BETWEEN 1 AND 160),
 phone text NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 30),
 message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000)
);
GRANT SELECT ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read contact submissions" ON public.contact_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX contact_submissions_created_at_idx ON public.contact_submissions (created_at DESC);