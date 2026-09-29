-- ============================================================
-- Migration 029: RİBA School Target Results
-- Final school-level target result snapshot
-- ============================================================
BEGIN;
CREATE TABLE public.riba_school_target_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL
        REFERENCES public.riba_applications(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    target_id UUID NOT NULL
        REFERENCES public.riba_targets(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    -- Number of class ASP values included in the school result.
    class_count INTEGER NOT NULL
        CHECK (class_count >= 0),
    -- Arithmetic mean of valid class ASP values.
    average_asp DOUBLE PRECISION,
    -- Official school-level ranking (RANK.EQ descending).
    rank INTEGER
        CHECK (rank IS NULL OR rank >= 1),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_riba_school_target_results
        UNIQUE (application_id, target_id)
);
CREATE INDEX idx_riba_school_target_results_application
    ON public.riba_school_target_results (application_id);
CREATE INDEX idx_riba_school_target_results_target
    ON public.riba_school_target_results (target_id);
CREATE INDEX idx_riba_school_target_results_rank
    ON public.riba_school_target_results (application_id, rank);
-- Backend-first security.
ALTER TABLE public.riba_school_target_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_school_target_results
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_school_target_results
TO service_role;
COMMIT;
