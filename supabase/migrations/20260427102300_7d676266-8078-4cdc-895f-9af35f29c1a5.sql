CREATE TABLE IF NOT EXISTS public.application_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.seller_applications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_notes_app_idx ON public.application_notes(application_id);

ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all application notes"
ON public.application_notes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create application notes"
ON public.application_notes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid());

CREATE POLICY "Admins delete own application notes"
ON public.application_notes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid());
