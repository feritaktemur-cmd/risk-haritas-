-- ============================================================
-- Migration 028: RİBA Class Target Results
-- Final target-level calculation snapshot for each class
-- ============================================================
BEGIN;
CREATE TABLE public.riba_class_target_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_result_id UUID NOT NULL
        REFERENCES public.riba_class_results(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    target_id UUID NOT NULL
        REFERENCES public.riba_targets(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    -- Student group
    student_frequency INTEGER
        CHECK (student_frequency IS NULL OR student_frequency >= 0),
    student_mean DOUBLE PRECISION,
    student_stddev DOUBLE PRECISION
        CHECK (student_stddev IS NULL OR student_stddev >= 0),
    student_standard_score DOUBLE PRECISION,
    -- Parent group
    parent_frequency INTEGER
        CHECK (parent_frequency IS NULL OR parent_frequency >= 0),
    parent_mean DOUBLE PRECISION,
    parent_stddev DOUBLE PRECISION
        CHECK (parent_stddev IS NULL OR parent_stddev >= 0),
    parent_standard_score DOUBLE PRECISION,
    -- Teacher group
    teacher_frequency INTEGER
        CHECK (teacher_frequency IS NULL OR teacher_frequency >= 0),
    teacher_mean DOUBLE PRECISION,
    teacher_stddev DOUBLE PRECISION
        CHECK (teacher_stddev IS NULL OR teacher_stddev >= 0),
    teacher_standard_score DOUBLE PRECISION,
    -- Weighted final score (ASP)
    asp DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_riba_class_target_results
        UNIQUE (class_result_id, target_id)
);
CREATE INDEX idx_riba_class_target_results_class_result
    ON public.riba_class_target_results (class_result_id);
CREATE INDEX idx_riba_class_target_results_target
    ON public.riba_class_target_results (target_id);
-- Backend-first security.
ALTER TABLE public.riba_class_target_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_class_target_results
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_class_target_results
TO service_role;
COMMIT;
