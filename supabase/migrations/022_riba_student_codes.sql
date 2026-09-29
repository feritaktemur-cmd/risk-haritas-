-- ============================================================
-- Migration 022: RİBA Student Codes
-- ============================================================
BEGIN;
CREATE TABLE public.riba_student_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_class_id UUID NOT NULL
        REFERENCES public.riba_application_classes(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_riba_student_codes_code_hash
        UNIQUE (code_hash)
);
CREATE INDEX idx_riba_student_codes_application_class
    ON public.riba_student_codes (application_class_id);
CREATE INDEX idx_riba_student_codes_unused
    ON public.riba_student_codes (application_class_id)
    WHERE used_at IS NULL;
-- Backend-first güvenlik.
ALTER TABLE public.riba_student_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_student_codes
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_student_codes
TO service_role;
COMMIT;
