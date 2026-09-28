-- =====================================================================
-- Migration 016: RİBA foundation (reference layer only)
-- Scope (STRICT): create THREE new tables —
--   public.riba_targets     (MEB guidance targets, e.g. M01, M02 ...)
--   public.riba_forms       (one form per education level + participant + version)
--   public.riba_questions   (forced-choice A/B items, each option -> a target)
-- plus their FKs, UNIQUE constraints, FK indexes, per-table updated_at
-- triggers, and RLS enable (NO policies).
--
-- Purpose: data dictionary for the RİBA (Rehberlik İhtiyacı Belirleme Anketi)
-- module. Reuses the existing public.education_levels (SMALLINT id) — NO new,
-- parallel education-level system is introduced. MEB codes are stored with
-- their OFFICIAL values (M01, M02 ...) and are NOT renumbered by the app.
--
-- Does NOT: create riba_applications / answer / result tables, seed any MEB
--           target/question/answer data, add MEB scoring formulas, create
--           endpoints / UI / QR / participant forms, add RLS policies, or
--           alter ANY existing table/module (Risk Map, RAM, Migrations 001-015
--           objects/data are untouched). No secret / service_role values here.
-- Result: all three new tables RLS = ON, policy count = 0.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: riba_targets
-- The official MEB guidance targets. meb_code is the stable, official
-- identity (e.g. 'M01'); it is UNIQUE and never renumbered by the app.
-- ---------------------------------------------------------------------
CREATE TABLE public.riba_targets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meb_code   TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- TABLE: riba_forms
-- One RİBA questionnaire variant, identified by education level +
-- participant type + version. education_level_id reuses the existing
-- SMALLINT education_levels table (no parallel level system).
-- ---------------------------------------------------------------------
CREATE TABLE public.riba_forms (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    education_level_id SMALLINT NOT NULL
                       REFERENCES public.education_levels(id)
                       ON UPDATE CASCADE ON DELETE RESTRICT,
    participant_type   TEXT NOT NULL,
    version            SMALLINT NOT NULL DEFAULT 1,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_riba_forms_participant_type
        CHECK (participant_type IN ('student', 'parent', 'teacher')),
    CONSTRAINT chk_riba_forms_version
        CHECK (version >= 1),
    -- One form per (level, participant type, version).
    CONSTRAINT uq_riba_forms_level_participant_version
        UNIQUE (education_level_id, participant_type, version)
);

CREATE INDEX ix_riba_forms_education_level_id ON public.riba_forms (education_level_id);

-- ---------------------------------------------------------------------
-- TABLE: riba_questions
-- Forced-choice A/B items. Each option carries its OFFICIAL MEB text and
-- links to the riba_targets row it counts toward. question_no is unique
-- within a form.
-- ---------------------------------------------------------------------
CREATE TABLE public.riba_questions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id            UUID NOT NULL
                       REFERENCES public.riba_forms(id) ON DELETE CASCADE,
    question_no        SMALLINT NOT NULL,

    option_a_text      TEXT NOT NULL,
    option_a_target_id UUID NOT NULL
                       REFERENCES public.riba_targets(id) ON DELETE RESTRICT,

    option_b_text      TEXT NOT NULL,
    option_b_target_id UUID NOT NULL
                       REFERENCES public.riba_targets(id) ON DELETE RESTRICT,

    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_riba_questions_question_no
        CHECK (question_no >= 1),
    CONSTRAINT uq_riba_questions_form_no
        UNIQUE (form_id, question_no)
);

CREATE INDEX ix_riba_questions_form_id           ON public.riba_questions (form_id);
CREATE INDEX ix_riba_questions_option_a_target   ON public.riba_questions (option_a_target_id);
CREATE INDEX ix_riba_questions_option_b_target   ON public.riba_questions (option_b_target_id);

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance (table-specific functions/triggers; existing
-- Migration 001-015 functions and triggers are left untouched).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_riba_targets_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS riba_targets_set_updated_at ON public.riba_targets;
CREATE TRIGGER riba_targets_set_updated_at
    BEFORE UPDATE ON public.riba_targets
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_riba_targets_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_riba_forms_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS riba_forms_set_updated_at ON public.riba_forms;
CREATE TRIGGER riba_forms_set_updated_at
    BEFORE UPDATE ON public.riba_forms
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_riba_forms_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_riba_questions_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS riba_questions_set_updated_at ON public.riba_questions;
CREATE TRIGGER riba_questions_set_updated_at
    BEFORE UPDATE ON public.riba_questions
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_riba_questions_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later task). Access is
-- via the backend service client + authorization helpers, same as the
-- existing RİBA-adjacent tables.
-- Result: RLS = ON, policy count = 0 for all three tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.riba_targets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riba_forms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riba_questions ENABLE ROW LEVEL SECURITY;

COMMIT;
