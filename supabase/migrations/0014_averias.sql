-- Migration 0014: Averías y Fallos con fotos y avisos en tiempo real
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_averias boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.averias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  machine_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendiente',
  status_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.averias ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para averias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'averias' AND policyname = 'Averias read access'
  ) THEN
    CREATE POLICY "Averias read access" ON public.averias
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'averias' AND policyname = 'Averias insert access'
  ) THEN
    CREATE POLICY "Averias insert access" ON public.averias
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'averias' AND policyname = 'Averias update access'
  ) THEN
    CREATE POLICY "Averias update access" ON public.averias
      FOR UPDATE TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'averias' AND policyname = 'Averias delete access'
  ) THEN
    CREATE POLICY "Averias delete access" ON public.averias
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
