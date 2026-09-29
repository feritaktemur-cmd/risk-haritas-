-- ============================================================
-- Migration 020: RİBA Applications
-- ============================================================

BEGIN;

CREATE TABLE public.riba_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES public.schools(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    academic_year_id UUID NOT NULL
        REFERENCES public.academic_years(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    name TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'closed', 'finalized')),

    teacher_count INTEGER NOT NULL
        CHECK (teacher_count >= 0),

    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,

    special_target_1_id UUID
        REFERENCES public.riba_targets(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    special_target_2_id UUID
        REFERENCES public.riba_targets(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_riba_applications_special_targets_different
        CHECK (
            special_target_1_id IS NULL
            OR special_target_2_id IS NULL
            OR special_target_1_id <> special_target_2_id
        )
);

CREATE INDEX idx_riba_applications_school
    ON public.riba_applications (school_id);

CREATE INDEX idx_riba_applications_academic_year
    ON public.riba_applications (academic_year_id);

CREATE INDEX idx_riba_applications_school_year
    ON public.riba_applications (school_id, academic_year_id);

CREATE INDEX idx_riba_applications_status
    ON public.riba_applications (status);

-- Mevcut RİBA tablolarıyla aynı updated_at yaklaşımı.
CREATE OR REPLACE FUNCTION public.tg_riba_applications_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER riba_applications_set_updated_at
BEFORE UPDATE ON public.riba_applications
FOR EACH ROW
EXECUTE FUNCTION public.tg_riba_applications_set_updated_at();

-- Backend-first güvenlik.
ALTER TABLE public.riba_applications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.riba_applications
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_applications
TO service_role;

COMMIT;
