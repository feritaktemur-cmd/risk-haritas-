-- =====================================================================
-- Migration 009: Student pool data foundation (students +
--                student_class_enrollments)
-- Scope (STRICT): create public.students + public.student_class_enrollments
--                 + their updated_at triggers + a same-school integrity
--                 trigger on student_class_enrollments + RLS enable ONLY.
--
-- Purpose: students are a permanent, shared pool reused across Risk Map,
-- Student Recognition Form, Problem Screening Inventory and other guidance
-- forms/scales. A student's CLASS is NOT fixed on the student row; it is
-- represented per academic year via student_class_enrollments so history
-- is preserved and old forms keep their correct year/class context.
--
-- CROSS-SCHOOL INTEGRITY: an enrollment's class must belong to the SAME
-- school as the student. Enforced at the DB level using ONLY new objects
-- created by THIS migration: a table-specific BEFORE INSERT OR UPDATE
-- trigger on student_class_enrollments. No changes are made to
-- school_classes (no ALTER / no new constraint / no new index) or to any
-- other Migration 001-008 object.
--
-- Does NOT: create students/enrollments seed data, test students, any UI,
--           any endpoint, Excel import, grade-promotion logic, risk/form
--           tables, reporting, RLS policies, or return-to-school flow.
--           Does NOT edit or alter Migration 001-008 files/objects/data.
--           Auth users and existing school/admin login flows are untouched.
-- No secret / service_role values are stored here.
-- Result for both new tables: RLS = ON, policy count = 0.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: students
-- One permanent record per student within a school. The class/branch is
-- NOT stored here (it changes per academic year — see
-- student_class_enrollments). A student who leaves and later returns to
-- the SAME school is re-activated (status -> 'active'), never duplicated;
-- the data model does not force a new row for returners.
-- ---------------------------------------------------------------------
CREATE TABLE public.students (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id      UUID NOT NULL
                   REFERENCES public.schools(id) ON DELETE RESTRICT,

    -- In-school student number. TEXT on purpose so leading zeros are
    -- preserved (e.g. '0012' stays '0012'). No normalization / search
    -- index here (deferred to a later task).
    student_number TEXT NOT NULL,

    first_name     TEXT NOT NULL,
    last_name      TEXT NOT NULL,

    -- Lifecycle status (first version supports exactly three values):
    --   active     -> still enrolled and attending this school
    --   left       -> transferred / left during the academic year
    --   graduated  -> completed this school's level and exited
    -- Grade repetition or branch change are NOT statuses.
    status         TEXT NOT NULL DEFAULT 'active',

    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_students_status
        CHECK (status IN ('active', 'left', 'graduated')),

    -- Same student number cannot repeat within one school; different
    -- schools may freely reuse the same number.
    CONSTRAINT uq_students_school_student_number
        UNIQUE (school_id, student_number)
);

-- ---------------------------------------------------------------------
-- TABLE: student_class_enrollments
-- A student's class for a specific academic year. History is preserved:
-- old-year enrollment rows are never deleted, so a student can have
--   2026-2027 -> 7/A
--   2027-2028 -> 8/A
-- as two separate rows. No class-history / movement table is created here.
--
-- school_id is stored on the row for integrity (checked by the trigger
-- below to equal both the student's and the class's school).
-- ---------------------------------------------------------------------
CREATE TABLE public.student_class_enrollments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id       UUID NOT NULL
                     REFERENCES public.students(id) ON DELETE RESTRICT,

    school_id        UUID NOT NULL,

    school_class_id  UUID NOT NULL
                     REFERENCES public.school_classes(id) ON DELETE RESTRICT,

    academic_year_id UUID NOT NULL
                     REFERENCES public.academic_years(id) ON DELETE RESTRICT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A student can belong to only ONE class within a given academic year.
    -- e.g. having 2026-2027 -> 7/A forbids adding 2026-2027 -> 7/B.
    -- Branch/class change within the same year is done later at the
    -- application layer by updating this existing row (controlled).
    CONSTRAINT uq_student_enrollment_student_year
        UNIQUE (student_id, academic_year_id)
);

-- ---------------------------------------------------------------------
-- Same-school integrity trigger (this migration's own object only).
-- Rejects any INSERT/UPDATE where the student's school, the class's
-- school, and NEW.school_id are not all identical. Prevents cross-school
-- enrollments (student in School A, class in School B).
--
-- SECURITY DEFINER + SET search_path='' so it reliably reads students /
-- school_classes regardless of the caller's RLS context; STABLE lookups.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_student_class_enrollments_same_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student_school_id UUID;
    v_class_school_id   UUID;
BEGIN
    SELECT s.school_id INTO v_student_school_id
    FROM public.students s
    WHERE s.id = NEW.student_id;

    SELECT sc.school_id INTO v_class_school_id
    FROM public.school_classes sc
    WHERE sc.id = NEW.school_class_id;

    IF v_student_school_id IS NULL THEN
        RAISE EXCEPTION 'student % not found', NEW.student_id;
    END IF;

    IF v_class_school_id IS NULL THEN
        RAISE EXCEPTION 'school_class % not found', NEW.school_class_id;
    END IF;

    IF NOT (v_student_school_id = v_class_school_id
            AND v_student_school_id = NEW.school_id) THEN
        RAISE EXCEPTION
            'cross-school enrollment rejected: student.school_id=%, class.school_id=%, enrollment.school_id=%',
            v_student_school_id, v_class_school_id, NEW.school_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_class_enrollments_same_school
    ON public.student_class_enrollments;
CREATE TRIGGER student_class_enrollments_same_school
    BEFORE INSERT OR UPDATE ON public.student_class_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_student_class_enrollments_same_school();

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance via BEFORE UPDATE triggers.
-- Table-specific function/trigger names; existing Migration 006/007/008
-- functions and triggers are left untouched.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_students_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_set_updated_at ON public.students;
CREATE TRIGGER students_set_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_students_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_student_class_enrollments_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_class_enrollments_set_updated_at
    ON public.student_class_enrollments;
CREATE TRIGGER student_class_enrollments_set_updated_at
    BEFORE UPDATE ON public.student_class_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_student_class_enrollments_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later task).
-- With RLS enabled and no policies, only the table owner and the
-- service_role (which bypasses RLS) can access rows.
-- Result: RLS = ON, policy count = 0 for both tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_class_enrollments ENABLE ROW LEVEL SECURITY;

COMMIT;
