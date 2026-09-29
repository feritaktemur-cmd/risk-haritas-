-- ============================================================
-- Migration 024: RİBA Answers
-- ============================================================
BEGIN;
CREATE TABLE public.riba_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL
        REFERENCES public.riba_responses(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    question_id UUID NOT NULL
        REFERENCES public.riba_questions(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    selected_option TEXT NOT NULL
        CHECK (selected_option IN ('A', 'B')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_riba_answers_response_question
        UNIQUE (response_id, question_id)
);
CREATE INDEX idx_riba_answers_response
    ON public.riba_answers (response_id);
CREATE INDEX idx_riba_answers_question
    ON public.riba_answers (question_id);
-- Backend-first güvenlik.
ALTER TABLE public.riba_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_answers
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_answers
TO service_role;
COMMIT;
