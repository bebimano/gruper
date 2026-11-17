-- Migration 0012: worker initials for report numbering format ([INICIALES][AÑO][00001])
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS initials text NOT NULL DEFAULT '';
