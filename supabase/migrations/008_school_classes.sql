-- =====================================================================
-- Migration 008: School class definitions (school_classes)
-- Scope (STRICT): create public.school_classes + updated_at trigger + RLS
--                 enable ONLY.
--
-- Each school owns only its own class/branch definitions (e.g. 1/A, 7/C,
-- 12/A; preschools reuse the same shape as age groups, e.g. 4/A, 5/B).
-- No student counts are stored. No editing structure. No risk/form tables.
--
-- Does NOT: touch schools / school_accounts / admin_profiles data or
--           structure, Migration 006/007 objects, Auth users, or existing
--           school login flow. No RLS policies (deferred). No seed data.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: school_classes
-- ---------------------------------------------------------------------
CREATE TABLE public.school_classes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id  UUID NOT NULL
               REFERENCES public.schools(id) ON DELETE RESTRICT,

    -- Level / age group: 1..12 (DB-enforced). Preschool's 4/5-only rule is
    -- an application-layer concern handled in a later task, not here.
    level      SMALLINT NOT NULL,

    -- Branch: exactly one uppercase Latin letter A-Z (no free text).
    branch     TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_school_classes_level
        CHECK (level BETWEEN 1 AND 12),

    CONSTRAINT chk_school_classes_branch
        CHECK (branch ~ '^[A-Z]$'),

    -- Same class cannot repeat within one school; different schools are
    -- independent.
    CONSTRAINT uq_school_classes_school_level_branch
        UNIQUE (school_id, level, branch)
);

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance via BEFORE UPDATE trigger (table-specific
-- names; does not touch Migration 006/007 functions/triggers).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_school_classes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_classes_set_updated_at ON public.school_classes;
CREATE TRIGGER school_classes_set_updated_at
    BEFORE UPDATE ON public.school_classes
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_school_classes_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later task).
-- Result: RLS = ON, policy count = 0.
-- ---------------------------------------------------------------------
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;

COMMIT;
