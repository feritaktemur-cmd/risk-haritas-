-- ============================================================
-- Migration 021: RİBA Application Classes
-- ============================================================
BEGIN;
CREATE TABLE public.riba_application_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL
        REFERENCES public.riba_applications(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    school_class_id UUID NOT NULL
        REFERENCES public.school_classes(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_riba_application_classes
        UNIQUE (application_id, school_class_id)
);
CREATE INDEX idx_riba_application_classes_application
    ON public.riba_application_classes (application_id);
CREATE INDEX idx_riba_application_classes_school_class
    ON public.riba_application_classes (school_class_id);
-- Backend-first güvenlik.
ALTER TABLE public.riba_application_classes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_application_classes
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_application_classes
TO service_role;
COMMIT;
