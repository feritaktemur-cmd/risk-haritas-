-- =====================================================================
-- Migration 013: School -> RAM submission & snapshot infrastructure
-- Scope (STRICT): create 6 new tables + a school_submissions updated_at
--                 trigger + RLS enable ONLY.
--
-- Purpose: when a school clicks "RAM'a Gönder", the AGGREGATED results at
-- that moment are frozen as an immutable snapshot. RAM analyses read these
-- frozen snapshots, NOT the school's ever-changing live data. Corrections
-- produce a NEW submission with a new version_no; existing snapshots are
-- never silently changed.
--
-- IMMUTABILITY PRINCIPLE (enforced later by the app layer, NOT here):
--   * An approved snapshot must never be modified or deleted by the app.
--   * Snapshot detail tables are never hand-edited by schools.
--   * Only a future, trusted submission backend routine writes these rows.
-- This migration builds ONLY the data model; no workflow triggers, no
-- version-number generation, no aggregation logic.
--
-- PRIVACY (critical): NO student_id, name, surname, student number, or any
-- per-student risk list is stored anywhere here. Only aggregated counts
-- cross into the RAM side.
--
-- Does NOT: create endpoints/UI/RAM panel/buttons/notifications, snapshot
--           computation, seed/test submissions, risk scores/levels, new
--           categories/domains. Does NOT ALTER/DROP any Migration 001-012
--           object. No secret / service_role values stored here.
-- Result: all 6 new tables RLS = ON, policy count = 0.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: school_submissions
-- One row per submission (a versioned, frozen school-level summary).
-- reviewed_by references admin_profiles.id (verified UUID PK, Migration 007).
-- ---------------------------------------------------------------------
CREATE TABLE public.school_submissions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id            UUID NOT NULL
                         REFERENCES public.schools(id) ON DELETE RESTRICT,

    academic_year_id     UUID NOT NULL
                         REFERENCES public.academic_years(id) ON DELETE RESTRICT,

    version_no           INTEGER NOT NULL,

    status               TEXT NOT NULL DEFAULT 'submitted',

    submitted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at          TIMESTAMPTZ NULL,
    reviewed_by          UUID NULL
                         REFERENCES public.admin_profiles(id) ON DELETE RESTRICT,
    revision_note        TEXT NULL,

    -- Frozen school-level summary (percentages are NOT stored; computed
    -- later as completed_students / total_students).
    total_students       INTEGER NOT NULL,
    completed_students   INTEGER NOT NULL,
    not_entered_students INTEGER NOT NULL,
    total_risk_marks     INTEGER NOT NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_school_submissions_status
        CHECK (status IN ('submitted', 'under_review', 'revision_requested', 'approved')),

    CONSTRAINT uq_school_submissions_school_year_version
        UNIQUE (school_id, academic_year_id, version_no),

    CONSTRAINT chk_school_submissions_nonneg
        CHECK (
            total_students >= 0
            AND completed_students >= 0
            AND not_entered_students >= 0
            AND total_risk_marks >= 0
        ),

    CONSTRAINT chk_school_submissions_completed_sum
        CHECK (completed_students + not_entered_students = total_students)
);

-- ---------------------------------------------------------------------
-- TABLE: submission_risk_totals
-- Frozen per-submission totals for the 36 risk categories (school level).
-- Percentages are NOT stored; RAM computes denominator = completed_students.
-- ---------------------------------------------------------------------
CREATE TABLE public.submission_risk_totals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id    UUID NOT NULL
                     REFERENCES public.school_submissions(id) ON DELETE CASCADE,

    risk_category_id UUID NOT NULL
                     REFERENCES public.risk_categories(id) ON DELETE RESTRICT,

    student_count    INTEGER NOT NULL DEFAULT 0,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_submission_risk_totals
        UNIQUE (submission_id, risk_category_id),

    CONSTRAINT chk_submission_risk_totals_nonneg
        CHECK (student_count >= 0)
);

-- ---------------------------------------------------------------------
-- TABLE: submission_domain_totals
-- Frozen per-submission totals for the 8 risk domains (school level).
-- student_count is a DISTINCT-STUDENT count (a student with several risks
-- in the same domain counts ONCE), NOT a risk-mark count.
-- ---------------------------------------------------------------------
CREATE TABLE public.submission_domain_totals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id  UUID NOT NULL
                   REFERENCES public.school_submissions(id) ON DELETE CASCADE,

    risk_domain_id UUID NOT NULL
                   REFERENCES public.risk_domains(id) ON DELETE RESTRICT,

    student_count  INTEGER NOT NULL DEFAULT 0,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_submission_domain_totals
        UNIQUE (submission_id, risk_domain_id),

    CONSTRAINT chk_submission_domain_totals_nonneg
        CHECK (student_count >= 0)
);

-- ---------------------------------------------------------------------
-- TABLE: submission_class_totals
-- Frozen anonymous per-class snapshot. class_name/grade_level/branch are
-- snapshots (e.g. '9/A') preserved even if the live class later changes.
-- school_class_id is a soft reference (SET NULL) so history survives class
-- deletion. (school_classes.id is UUID PK, Migration 008; the column is
-- nullable, so ON DELETE SET NULL is compatible — no live table altered.)
-- ---------------------------------------------------------------------
CREATE TABLE public.submission_class_totals (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id        UUID NOT NULL
                         REFERENCES public.school_submissions(id) ON DELETE CASCADE,

    school_class_id      UUID NULL
                         REFERENCES public.school_classes(id) ON DELETE SET NULL,

    class_name           TEXT NOT NULL,
    grade_level          SMALLINT NOT NULL,
    branch               TEXT NOT NULL,

    total_students       INTEGER NOT NULL,
    completed_students   INTEGER NOT NULL,
    not_entered_students INTEGER NOT NULL,
    total_risk_marks     INTEGER NOT NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_submission_class_totals
        UNIQUE (submission_id, class_name),

    CONSTRAINT chk_submission_class_totals_nonneg
        CHECK (
            total_students >= 0
            AND completed_students >= 0
            AND not_entered_students >= 0
            AND total_risk_marks >= 0
        ),

    CONSTRAINT chk_submission_class_totals_completed_sum
        CHECK (completed_students + not_entered_students = total_students)
);

-- ---------------------------------------------------------------------
-- TABLE: submission_class_risk_totals
-- Frozen per-snapshot-class x 36 risk categories totals.
-- ---------------------------------------------------------------------
CREATE TABLE public.submission_class_risk_totals (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_class_total_id UUID NOT NULL
                              REFERENCES public.submission_class_totals(id) ON DELETE CASCADE,

    risk_category_id          UUID NOT NULL
                              REFERENCES public.risk_categories(id) ON DELETE RESTRICT,

    student_count             INTEGER NOT NULL DEFAULT 0,

    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_submission_class_risk_totals
        UNIQUE (submission_class_total_id, risk_category_id),

    CONSTRAINT chk_submission_class_risk_totals_nonneg
        CHECK (student_count >= 0)
);

-- ---------------------------------------------------------------------
-- TABLE: submission_class_domain_totals
-- Frozen per-snapshot-class x 8 risk domains totals. student_count is a
-- DISTINCT-STUDENT count (same student, multiple risks in one domain -> 1).
-- ---------------------------------------------------------------------
CREATE TABLE public.submission_class_domain_totals (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_class_total_id UUID NOT NULL
                              REFERENCES public.submission_class_totals(id) ON DELETE CASCADE,

    risk_domain_id            UUID NOT NULL
                              REFERENCES public.risk_domains(id) ON DELETE RESTRICT,

    student_count             INTEGER NOT NULL DEFAULT 0,

    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_submission_class_domain_totals
        UNIQUE (submission_class_total_id, risk_domain_id),

    CONSTRAINT chk_submission_class_domain_totals_nonneg
        CHECK (student_count >= 0)
);

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance for school_submissions (workflow status can
-- change). Snapshot detail tables are point-in-time immutable and get NO
-- updated_at. Table-specific names; Migration 006-012 objects untouched.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_school_submissions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_submissions_set_updated_at ON public.school_submissions;
CREATE TRIGGER school_submissions_set_updated_at
    BEFORE UPDATE ON public.school_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_school_submissions_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later task).
-- Result: RLS = ON, policy count = 0 for all 6 tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.school_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_risk_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_domain_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_class_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_class_risk_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_class_domain_totals ENABLE ROW LEVEL SECURITY;

COMMIT;
