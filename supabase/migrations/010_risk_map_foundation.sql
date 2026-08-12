-- =====================================================================
-- Migration 010: Risk Map data foundation (risk_categories + student_risks)
-- Scope (STRICT): create public.risk_categories (+ seed 36 fixed items) and
--                 public.student_risks, their updated_at triggers, a
--                 same-school integrity trigger and a "note" integrity
--                 trigger on student_risks, and RLS enable ONLY.
--
-- Model: the primary Risk Map data is per-student risk MARKS. A student may
-- have many risk items; ONLY marked items are stored as rows in
-- student_risks. Unmarked items produce NO row (no false/no/0 records).
-- Each risk item is an independent indicator — this migration creates NO
-- risk score / total / severity / level and NO student risk labeling.
--
-- Does NOT: create UI, endpoints, risk-entry screens, class/school risk maps,
--           analytics, snapshots, submission/approval, version tables, risk
--           scores, student labels, test students, test risk records, auto
--           risk records for existing students, or RLS policies.
--           Does NOT edit or alter Migration 001-009 files/objects/data.
-- No secret / service_role values are stored here.
-- Result for both new tables: RLS = ON, policy count = 0.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: risk_categories
-- The 36 fixed risk items. code + sort_order are stable identities used
-- later for reporting and historical comparison. sort_order is limited to
-- 1..36 by CHECK. Only RISK-036 ("Diğer") requires an explanatory note.
-- ---------------------------------------------------------------------
CREATE TABLE public.risk_categories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          TEXT NOT NULL UNIQUE,
    sort_order    SMALLINT NOT NULL UNIQUE,
    label         TEXT NOT NULL,
    requires_note BOOLEAN NOT NULL DEFAULT false,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_risk_categories_sort_order
        CHECK (sort_order BETWEEN 1 AND 36)
);

-- ---------------------------------------------------------------------
-- Seed: the 36 fixed risk items, in exact order RISK-001..RISK-036.
-- code <-> sort_order map 1:1. Wording is the finalized, standardized
-- text; only RISK-036 has requires_note = true.
-- ---------------------------------------------------------------------
INSERT INTO public.risk_categories (code, sort_order, label, requires_note) VALUES
    ('RISK-001',  1,  'Anne en fazla ilkokul mezunu', false),
    ('RISK-002',  2,  'Baba en fazla ilkokul mezunu', false),
    ('RISK-003',  3,  'Tek çocuk olan', false),
    ('RISK-004',  4,  '5 ve üstü kardeşi olan', false),
    ('RISK-005',  5,  'Anne ve babası ayrı yaşayan', false),
    ('RISK-006',  6,  'Anne ve babası boşanmış olan', false),
    ('RISK-007',  7,  'Yalnızca annesi ile yaşayan', false),
    ('RISK-008',  8,  'Yalnızca babası ile yaşayan', false),
    ('RISK-009',  9,  'Annesi hayatta olmayan', false),
    ('RISK-010', 10,  'Babası hayatta olmayan', false),
    ('RISK-011', 11,  'Anne ve babası hayatta olmayan', false),
    ('RISK-012', 12,  'Şehit çocuğu', false),
    ('RISK-013', 13,  'Yalnızca büyükanne/büyükbabasıyla yaşayan', false),
    ('RISK-014', 14,  'Yalnızca diğer akrabalarıyla yaşayan', false),
    ('RISK-015', 15,  'Koruyucu aile gözetiminde olan', false),
    ('RISK-016', 16,  'Sevgi Evlerinde kalan', false),
    ('RISK-017', 17,  'Sosyal Hizmetler Çocuk Esirgeme Kurumunda kalan', false),
    ('RISK-018', 18,  'Ailesinde süreğen hastalığı olan', false),
    ('RISK-019', 19,  'Ailesinde ruhsal hastalığı olan', false),
    ('RISK-020', 20,  'Ailesinde bağımlı bireyler bulunan (alkol/madde)', false),
    ('RISK-021', 21,  'Ailesinde cezai hükmü bulunan', false),
    ('RISK-022', 22,  'Ailesi mevsimlik işçi olan', false),
    ('RISK-023', 23,  'Aile içi şiddete maruz kalan', false),
    ('RISK-024', 24,  'Özel yetenekli tanısı olan', false),
    ('RISK-025', 25,  'Yetersizlik alanında özel eğitim raporu olan', false),
    ('RISK-026', 26,  'Süreğen hastalığı olan', false),
    ('RISK-027', 27,  'Ruhsal hastalığı olan', false),
    ('RISK-028', 28,  'Danışmanlık tedbir kararı olan', false),
    ('RISK-029', 29,  'Eğitim tedbir kararı olan', false),
    ('RISK-030', 30,  'Maddi sıkıntı yaşayan', false),
    ('RISK-031', 31,  'Sürekli devamsız olan', false),
    ('RISK-032', 32,  'Bir işte çalışan', false),
    ('RISK-033', 33,  'Akademik başarısı düşük', false),
    ('RISK-034', 34,  'Riskli akran grubuna dahil olan', false),
    ('RISK-035', 35,  'Yabancı uyruklu öğrenci', false),
    ('RISK-036', 36,  'Diğer', true);

-- ---------------------------------------------------------------------
-- TABLE: student_risks
-- One row per MARKED risk item, per student, per academic year. No
-- school_class_id here: the class context is resolved via
-- (student_id, academic_year_id) -> student_class_enrollments, so there is
-- a single source of truth for class. No score / severity / level columns.
-- ---------------------------------------------------------------------
CREATE TABLE public.student_risks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id       UUID NOT NULL
                     REFERENCES public.students(id) ON DELETE RESTRICT,

    school_id        UUID NOT NULL
                     REFERENCES public.schools(id) ON DELETE RESTRICT,

    academic_year_id UUID NOT NULL
                     REFERENCES public.academic_years(id) ON DELETE RESTRICT,

    risk_category_id UUID NOT NULL
                     REFERENCES public.risk_categories(id) ON DELETE RESTRICT,

    note             TEXT NULL,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Same risk item cannot be added twice for the same student in the same
    -- year. Across different years the same item is allowed (history kept).
    CONSTRAINT uq_student_risk_student_year_category
        UNIQUE (student_id, academic_year_id, risk_category_id)
);

-- ---------------------------------------------------------------------
-- Same-school integrity trigger (this migration's own object only).
-- Rejects any INSERT/UPDATE where student_risks.school_id does not equal
-- the student's own students.school_id. No changes to the students table.
-- Follows the Migration 009 SECURITY DEFINER + search_path='' pattern.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_student_risks_same_school()
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
            'cross-school risk rejected: student.school_id=%, risk.school_id=%',
            v_student_school_id, NEW.school_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_risks_same_school ON public.student_risks;
CREATE TRIGGER student_risks_same_school
    BEFORE INSERT OR UPDATE ON public.student_risks
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_student_risks_same_school();

-- ---------------------------------------------------------------------
-- "Diğer" note integrity trigger (this migration's own object only).
-- Enforces, at the DB level (never trusting the frontend):
--   requires_note = true  -> trimmed note must be non-empty
--   requires_note = false -> note must be NULL
-- based on the referenced risk_categories.requires_note flag.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_student_risks_note_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_requires_note BOOLEAN;
BEGIN
    SELECT rc.requires_note INTO v_requires_note
    FROM public.risk_categories rc
    WHERE rc.id = NEW.risk_category_id;

    IF v_requires_note IS NULL THEN
        RAISE EXCEPTION 'risk_category % not found', NEW.risk_category_id;
    END IF;

    IF v_requires_note THEN
        IF NEW.note IS NULL OR btrim(NEW.note) = '' THEN
            RAISE EXCEPTION 'note is required for this risk category';
        END IF;
    ELSE
        IF NEW.note IS NOT NULL THEN
            RAISE EXCEPTION 'note is not allowed for this risk category';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_risks_note_integrity ON public.student_risks;
CREATE TRIGGER student_risks_note_integrity
    BEFORE INSERT OR UPDATE ON public.student_risks
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_student_risks_note_integrity();

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance via BEFORE UPDATE triggers.
-- Table-specific function/trigger names; existing Migration 006-009
-- functions and triggers are left untouched.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_risk_categories_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS risk_categories_set_updated_at ON public.risk_categories;
CREATE TRIGGER risk_categories_set_updated_at
    BEFORE UPDATE ON public.risk_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_risk_categories_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_student_risks_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_risks_set_updated_at ON public.student_risks;
CREATE TRIGGER student_risks_set_updated_at
    BEFORE UPDATE ON public.student_risks
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_student_risks_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later task).
-- Result: RLS = ON, policy count = 0 for both tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.risk_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_risks ENABLE ROW LEVEL SECURITY;

COMMIT;
