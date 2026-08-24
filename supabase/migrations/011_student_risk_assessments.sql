-- =====================================================================
-- Migration 011: Risk Map assessment status (student_risk_assessments)
-- Scope (STRICT): create public.student_risk_assessments + its updated_at
--                 trigger + a same-school integrity trigger + RLS enable ONLY.
--
-- Purpose: student_risks having 0 rows is ambiguous — it can mean either
-- "the Risk Map form was never entered" OR "the form was completed with no
-- risk item marked". The mere EXISTENCE of a row here means the student's
-- Risk Map form for that academic year has been processed/completed:
--   no assessment row + 0 risks -> Girilmedi
--   assessment row  + 0 risks   -> Tamamlandı · Risk yok
--   assessment row  + X risks   -> Tamamlandı · X risk
-- No new "no risk" category is created.
--
-- SINGLE SOURCE OF TRUTH: this table stores NO risk count / score / level,
-- NO class / branch, NO student name, NO risk category. Risk count comes
-- from student_risks; class comes from student_class_enrollments.
--
-- Does NOT: create endpoints, UI, class/school risk maps, charts, ratios,
--           scores, new risk categories, assessment seed for existing
--           students, test data, or RLS policies. Does NOT edit or alter
--           Migration 001-010 files/objects/data.
-- No secret / service_role values are stored here.
-- Result: RLS = ON, policy count = 0.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: student_risk_assessments
-- One row per (student, academic year) marks that year's Risk Map form as
-- completed. The composite FK to student_class_enrollments guarantees the
-- student actually has a class enrollment for that year (using the UNIQUE
-- (student_id, academic_year_id) target created in Migration 009 — the
-- student_class_enrollments table itself is NOT altered here).
-- ---------------------------------------------------------------------
CREATE TABLE public.student_risk_assessments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id       UUID NOT NULL,
    academic_year_id UUID NOT NULL,

    school_id        UUID NOT NULL
                     REFERENCES public.schools(id) ON DELETE RESTRICT,

    completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Only one assessment per student per academic year.
    CONSTRAINT uq_student_risk_assessment_student_year
        UNIQUE (student_id, academic_year_id),

    -- The student must have a class enrollment for this academic year.
    CONSTRAINT fk_assessment_enrollment
        FOREIGN KEY (student_id, academic_year_id)
        REFERENCES public.student_class_enrollments (student_id, academic_year_id)
        ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------
-- Same-school integrity trigger (this migration's own object only).
-- Rejects any INSERT/UPDATE where school_id does not equal the student's
-- own students.school_id. Follows the Migration 009/010 SECURITY DEFINER +
-- search_path='' pattern. Does not alter the students table.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_student_risk_assessments_same_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student_school_id UUID;
BEGIN
    SELECT s.school_id INTO v_student_school_id
    FROM public.students s
    WHERE s.id = NEW.student_id;

    IF v_student_school_id IS NULL THEN
        RAISE EXCEPTION 'student % not found', NEW.student_id;
    END IF;

    IF v_student_school_id <> NEW.school_id THEN
        RAISE EXCEPTION
            'cross-school assessment rejected: student.school_id=%, assessment.school_id=%',
            v_student_school_id, NEW.school_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_risk_assessments_same_school ON public.student_risk_assessments;
CREATE TRIGGER student_risk_assessments_same_school
    BEFORE INSERT OR UPDATE ON public.student_risk_assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_student_risk_assessments_same_school();

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance via BEFORE UPDATE trigger.
-- Table-specific function/trigger names; existing Migration 006-010
-- functions and triggers are left untouched.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_student_risk_assessments_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_risk_assessments_set_updated_at ON public.student_risk_assessments;
CREATE TRIGGER student_risk_assessments_set_updated_at
    BEFORE UPDATE ON public.student_risk_assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_student_risk_assessments_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later task).
-- Result: RLS = ON, policy count = 0.
-- ---------------------------------------------------------------------
ALTER TABLE public.student_risk_assessments ENABLE ROW LEVEL SECURITY;

COMMIT;
