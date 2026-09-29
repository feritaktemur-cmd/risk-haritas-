-- ============================================================
-- Migration 027: RİBA Class Results
-- Final class-level result snapshot header
-- ============================================================
BEGIN;
CREATE TABLE public.riba_class_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL
        REFERENCES public.riba_applications(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    school_class_id UUID NOT NULL
        REFERENCES public.school_classes(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    student_response_count INTEGER NOT NULL DEFAULT 0
        CHECK (student_response_count >= 0),
    parent_response_count INTEGER NOT NULL DEFAULT 0
        CHECK (parent_response_count >= 0),
    teacher_response_count INTEGER NOT NULL DEFAULT 0
        CHECK (teacher_response_count >= 0),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_riba_class_results_application_class
        UNIQUE (application_id, school_class_id)
);
CREATE INDEX idx_riba_class_results_application
    ON public.riba_class_results (application_id);
CREATE INDEX idx_riba_class_results_school_class
    ON public.riba_class_results (school_class_id);
-- Backend-first security.
ALTER TABLE public.riba_class_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_class_results
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_class_results
TO service_role;
COMMIT;
