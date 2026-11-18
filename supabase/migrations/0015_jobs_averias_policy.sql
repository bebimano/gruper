-- Migration 0015: Permitir lectura de averías en jobs para todos los usuarios autenticados
-- Esto asegura que Supabase Realtime transmita los eventos INSERT de averías a todos los técnicos

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'authenticated reads averia jobs'
  ) THEN
    CREATE POLICY "authenticated reads averia jobs" ON public.jobs
      FOR SELECT TO authenticated
      USING (title LIKE '[AVERÍA]%');
  END IF;
END $$;
