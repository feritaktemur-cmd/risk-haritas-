-- ============================================================
-- Migration 030: RİBA Application Forms
-- Bir uygulama aktive edildiğinde kullanılacak form sürümlerini sabitler.
-- riba_forms.is_active daha sonra değişse bile uygulamanın bağlı formu
-- değişmez. participant_type / education_level_id / version bu tabloda
-- tekrarlanmaz; form_id -> riba_forms üzerinden elde edilir.
-- ============================================================
BEGIN;
CREATE TABLE public.riba_application_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL
        REFERENCES public.riba_applications(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    form_id UUID NOT NULL
        REFERENCES public.riba_forms(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_riba_application_forms_application_form
        UNIQUE (application_id, form_id)
);
CREATE INDEX idx_riba_application_forms_application
    ON public.riba_application_forms (application_id);
CREATE INDEX idx_riba_application_forms_form
    ON public.riba_application_forms (form_id);
-- Backend-first güvenlik.
ALTER TABLE public.riba_application_forms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_application_forms
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_application_forms
TO service_role;
COMMIT;
