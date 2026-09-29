-- ============================================================
-- Migration 023: RİBA Responses
-- ============================================================
BEGIN;
CREATE TABLE public.riba_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL
        REFERENCES public.riba_applications(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    form_id UUID NOT NULL
        REFERENCES public.riba_forms(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    school_class_id UUID NOT NULL
        REFERENCES public.school_classes(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    participant_type TEXT NOT NULL
        CHECK (participant_type IN ('student', 'parent', 'teacher')),
    gender TEXT NOT NULL
        CHECK (gender IN ('K', 'E')),
    student_code_id UUID
        REFERENCES public.riba_student_codes(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_riba_responses_student_code
        CHECK (
            (participant_type = 'student' AND student_code_id IS NOT NULL)
            OR
            (participant_type IN ('parent', 'teacher') AND student_code_id IS NULL)
        ),
    CONSTRAINT uq_riba_responses_student_code
        UNIQUE (student_code_id)
);
CREATE INDEX idx_riba_responses_application
    ON public.riba_responses (application_id);
CREATE INDEX idx_riba_responses_application_class
    ON public.riba_responses (application_id, school_class_id);
CREATE INDEX idx_riba_responses_application_participant
    ON public.riba_responses (application_id, participant_type);
CREATE INDEX idx_riba_responses_form
    ON public.riba_responses (form_id);
-- Backend-first güvenlik.
ALTER TABLE public.riba_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_responses
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_responses
TO service_role;
COMMIT;
