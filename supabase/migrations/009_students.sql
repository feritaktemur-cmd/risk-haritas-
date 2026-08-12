-- =====================================================================
-- Migration 009: Student pool data foundation (students +
--                student_class_enrollments)
-- Scope (STRICT): create public.students + public.student_class_enrollments
--                 + their updated_at triggers + RLS enable, plus the
--                 minimal UNIQUE constraints needed for a composite FK
--                 that guarantees same-school enrollment (see below).
--
-- Purpose: students are a permanent, shared pool reused across Risk Map,
-- Student Recognition Form, Problem Screening Inventory and other guidance
-- forms/scales. A student's CLASS is NOT fixed on the student row; it is
-- represented per academic year via student_class_enrollments so history
-- is preserved and old forms keep their correct year/class context.
--
-- CROSS-SCHOOL INTEGRITY: an enrollment's school_class must belong to the
-- SAME school as the student. Enforced purely at the DB level (no trigger,
-- no subquery) via composite foreign keys keyed on (…, school_id).
--
-- Does NOT: create students/enrollments seed data, test students, any UI,
--           any endpoint, Excel import, grade-promotion logic, risk/form
--           tables, reporting, RLS policies, or return-to-school flow.
--           Does NOT edit Migration 001-008 files or alter their columns,
--           triggers, RLS, or data; the only touch to an existing table is
--           one ADDITIVE UNIQUE constraint on school_classes(id, school_id)
--           (id is already PK, so this adds no real restriction) required
--           as the target of the composite FK. Auth users and existing
--           school/admin login flows are untouched.
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
        UNIQUE (school_id, student_number),

    -- Composite-FK target: lets enrollments reference (student, school)
    -- together so the student's school is carried into the FK check.
    -- id is already the PK, so this UNIQUE adds no real restriction.
    CONSTRAINT uq_students_id_school
        UNIQUE (id, school_id)
);

-- ---------------------------------------------------------------------
-- Additive composite-FK target on the existing school_classes table.
-- id is already the PRIMARY KEY, so (id, school_id) is trivially unique
-- and this adds NO new restriction on existing rows/structure. It only
-- exists so student_class_enrollments can reference (school_class, school)
-- together and thereby force the class to share the student's school.
-- ---------------------------------------------------------------------
ALTER TABLE public.school_classes
    ADD CONSTRAINT uq_school_classes_id_school
        UNIQUE (id, school_id);

-- ---------------------------------------------------------------------
-- TABLE: student_class_enrollments
-- A student's class for a specific academic year. History is preserved:
-- old-year enrollment rows are never deleted, so a student can have
--   2026-2027 -> 7/A
--   2027-2028 -> 8/A
-- as two separate rows. No class-history / movement table is created here.
--
-- school_id is carried on the row solely to drive the composite FKs that
-- guarantee the student and the class belong to the SAME school.
-- ---------------------------------------------------------------------
CREATE TABLE public.student_class_enrollments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id       UUID NOT NULL,
    school_id        UUID NOT NULL,
    school_class_id  UUID NOT NULL,

    academic_year_id UUID NOT NULL
                     REFERENCES public.academic_years(id) ON DELETE RESTRICT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A student can belong to only ONE class within a given academic year.
    -- e.g. having 2026-2027 -> 7/A forbids adding 2026-2027 -> 7/B.
    -- Branch/class change within the same year is done later at the
    -- application layer by updating this existing row (controlled).
    CONSTRAINT uq_student_enrollment_student_year
        UNIQUE (student_id, academic_year_id),

    -- Composite FK #1: the student exists AND its school_id matches this
    -- row's school_id.
    CONSTRAINT fk_enrollment_student_school
        FOREIGN KEY (student_id, school_id)
        REFERENCES public.students (id, school_id)
        ON DELETE RESTRICT,

    -- Composite FK #2: the class exists AND its school_id matches this
    -- row's school_id. Together with FK #1 this makes cross-school
    -- enrollments (student in School A, class in School B) impossible.
    CONSTRAINT fk_enrollment_class_school
        FOREIGN KEY (school_class_id, school_id)
        REFERENCES public.school_classes (id, school_id)
        ON DELETE RESTRICT
);

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
