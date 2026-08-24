-- =====================================================================
-- Migration 012: Risk domains (classification / data-dictionary layer)
-- Scope (STRICT): create public.risk_domains (+ seed 8 domains),
--                 public.risk_category_domains (+ seed the 36->8 mapping),
--                 a risk_domains updated_at trigger, and RLS enable ONLY.
--
-- Purpose: group the 36 existing risk_categories into 8 top-level risk
-- domains. Each risk category maps to EXACTLY ONE domain.
--
-- This is ONLY a classification layer. It stores NO domain score, level,
-- weight, coefficient, percentage, prevalence rate or density. Those are
-- computed at analysis time, not stored. No view/function for prevalence
-- math is created here.
--
-- Does NOT: create endpoints, UI, charts, class/school/RAM analysis,
--           new risk categories, changes to existing risk categories,
--           RLS policies, or test data. Does NOT edit or alter
--           Migration 001-011 files/objects/data (risk_categories rows are
--           read only, never modified).
-- No secret / service_role values are stored here.
-- Result: both new tables RLS = ON, policy count = 0.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: risk_domains
-- The 8 fixed top-level risk domains. code + sort_order are stable
-- identities; sort_order limited to 1..8 by CHECK.
-- ---------------------------------------------------------------------
CREATE TABLE public.risk_domains (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL UNIQUE,
    sort_order SMALLINT NOT NULL UNIQUE,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_risk_domains_sort_order
        CHECK (sort_order BETWEEN 1 AND 8)
);

-- Seed: the 8 fixed domains in exact order DOMAIN-001..DOMAIN-008.
INSERT INTO public.risk_domains (code, sort_order, name) VALUES
    ('DOMAIN-001', 1, 'Aile Yapısı ve Ebeveyn Özellikleri'),
    ('DOMAIN-002', 2, 'Bakım ve Korunma Durumu'),
    ('DOMAIN-003', 3, 'Aile Kaynaklı Sağlık ve Psikososyal Riskler'),
    ('DOMAIN-004', 4, 'Öğrencinin Sağlık ve Özel Eğitim Durumu'),
    ('DOMAIN-005', 5, 'Koruyucu ve Destekleyici Tedbirler'),
    ('DOMAIN-006', 6, 'Ekonomik ve Eğitimsel Riskler'),
    ('DOMAIN-007', 7, 'Sosyal/Uyum Riskleri'),
    ('DOMAIN-008', 8, 'Diğer Riskler');

-- ---------------------------------------------------------------------
-- TABLE: risk_category_domains
-- Maps each risk_category to exactly one risk_domain. UNIQUE(risk_category_id)
-- enforces "one category -> one domain" (and inherently prevents a repeated
-- category/domain pair, so no extra composite unique is added).
-- ---------------------------------------------------------------------
CREATE TABLE public.risk_category_domains (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    risk_category_id UUID NOT NULL
                     REFERENCES public.risk_categories(id) ON DELETE RESTRICT,

    risk_domain_id   UUID NOT NULL
                     REFERENCES public.risk_domains(id) ON DELETE RESTRICT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_risk_category_domain_category
        UNIQUE (risk_category_id)
);

-- ---------------------------------------------------------------------
-- Seed the 36 -> 8 mapping by CODE (never hard-coding UUIDs).
-- Each SELECT resolves the current risk_categories.id / risk_domains.id.
-- Every one of the 36 categories is mapped exactly once.
-- ---------------------------------------------------------------------
INSERT INTO public.risk_category_domains (risk_category_id, risk_domain_id)
SELECT rc.id, rd.id
FROM public.risk_categories rc
JOIN (
    VALUES
        -- DOMAIN-001 — Aile Yapısı ve Ebeveyn Özellikleri (RISK-001..RISK-014)
        ('RISK-001', 'DOMAIN-001'),
        ('RISK-002', 'DOMAIN-001'),
        ('RISK-003', 'DOMAIN-001'),
        ('RISK-004', 'DOMAIN-001'),
        ('RISK-005', 'DOMAIN-001'),
        ('RISK-006', 'DOMAIN-001'),
        ('RISK-007', 'DOMAIN-001'),
        ('RISK-008', 'DOMAIN-001'),
        ('RISK-009', 'DOMAIN-001'),
        ('RISK-010', 'DOMAIN-001'),
        ('RISK-011', 'DOMAIN-001'),
        ('RISK-012', 'DOMAIN-001'),
        ('RISK-013', 'DOMAIN-001'),
        ('RISK-014', 'DOMAIN-001'),
        -- DOMAIN-002 — Bakım ve Korunma Durumu (RISK-015..RISK-017)
        ('RISK-015', 'DOMAIN-002'),
        ('RISK-016', 'DOMAIN-002'),
        ('RISK-017', 'DOMAIN-002'),
        -- DOMAIN-003 — Aile Kaynaklı Sağlık ve Psikososyal Riskler
        --   (RISK-018, RISK-019, RISK-020, RISK-021, RISK-023)
        ('RISK-018', 'DOMAIN-003'),
        ('RISK-019', 'DOMAIN-003'),
        ('RISK-020', 'DOMAIN-003'),
        ('RISK-021', 'DOMAIN-003'),
        ('RISK-023', 'DOMAIN-003'),
        -- DOMAIN-004 — Öğrencinin Sağlık ve Özel Eğitim Durumu (RISK-024..RISK-027)
        ('RISK-024', 'DOMAIN-004'),
        ('RISK-025', 'DOMAIN-004'),
        ('RISK-026', 'DOMAIN-004'),
        ('RISK-027', 'DOMAIN-004'),
        -- DOMAIN-005 — Koruyucu ve Destekleyici Tedbirler (RISK-028, RISK-029)
        ('RISK-028', 'DOMAIN-005'),
        ('RISK-029', 'DOMAIN-005'),
        -- DOMAIN-006 — Ekonomik ve Eğitimsel Riskler
        --   (RISK-022, RISK-030, RISK-031, RISK-032, RISK-033)
        ('RISK-022', 'DOMAIN-006'),
        ('RISK-030', 'DOMAIN-006'),
        ('RISK-031', 'DOMAIN-006'),
        ('RISK-032', 'DOMAIN-006'),
        ('RISK-033', 'DOMAIN-006'),
        -- DOMAIN-007 — Sosyal/Uyum Riskleri (RISK-034, RISK-035)
        ('RISK-034', 'DOMAIN-007'),
        ('RISK-035', 'DOMAIN-007'),
        -- DOMAIN-008 — Diğer Riskler (RISK-036)
        ('RISK-036', 'DOMAIN-008')
) AS m(risk_code, domain_code) ON m.risk_code = rc.code
JOIN public.risk_domains rd ON rd.code = m.domain_code;

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance for risk_domains (relation table needs none).
-- Table-specific function/trigger names; existing Migration 006-011
-- functions and triggers are left untouched.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_risk_domains_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS risk_domains_set_updated_at ON public.risk_domains;
CREATE TRIGGER risk_domains_set_updated_at
    BEFORE UPDATE ON public.risk_domains
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_risk_domains_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later task).
-- Result: RLS = ON, policy count = 0 for both tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.risk_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_category_domains ENABLE ROW LEVEL SECURITY;

COMMIT;
