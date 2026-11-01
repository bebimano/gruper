ALTER TABLE public.work_reports ADD COLUMN closed boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS "own reports" ON public.work_reports;
CREATE POLICY "own reports select" ON public.work_reports FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.can_work_reports(auth.uid()));
CREATE POLICY "own reports insert" ON public.work_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_work_reports(auth.uid()));
CREATE POLICY "own reports update open" ON public.work_reports FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.can_work_reports(auth.uid()) AND closed = false) WITH CHECK (user_id = auth.uid() AND public.can_work_reports(auth.uid()));
CREATE POLICY "own reports delete open" ON public.work_reports FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.can_work_reports(auth.uid()) AND closed = false);