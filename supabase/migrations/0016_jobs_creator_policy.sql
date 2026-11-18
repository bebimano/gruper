-- Migration 0016: Permisos para usuarios autorizados a crear y gestionar trabajos
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_create_jobs boolean DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'creators view all jobs'
  ) THEN
    CREATE POLICY "creators view all jobs" ON public.jobs
      FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(),'admin')
        OR assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND can_create_jobs = true)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'creators insert jobs'
  ) THEN
    CREATE POLICY "creators insert jobs" ON public.jobs
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND can_create_jobs = true)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'creators update jobs'
  ) THEN
    CREATE POLICY "creators update jobs" ON public.jobs
      FOR UPDATE TO authenticated
      USING (
        public.has_role(auth.uid(),'admin')
        OR assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND can_create_jobs = true)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'creators delete jobs'
  ) THEN
    CREATE POLICY "creators delete jobs" ON public.jobs
      FOR DELETE TO authenticated
      USING (
        public.has_role(auth.uid(),'admin')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND can_create_jobs = true)
      );
  END IF;
END $$;
