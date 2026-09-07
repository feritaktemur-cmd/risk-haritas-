-- =====================================================================
-- Migration 014: RAM Admin & RAM Çalışmaları — base infrastructure
-- Scope (STRICT): create 3 new tables (rams, ram_accounts, ram_activities)
--                 + their updated_at triggers + case-insensitive unique
--                 guards + needed indexes + RLS enable (NO policies).
--
-- Mirrors the school_accounts pattern (Migration 006):
--   * one institutional account per RAM (ram_id UNIQUE),
--   * auth_user_id UNIQUE -> auth.users(id) ON DELETE RESTRICT,
--   * username UNIQUE + case-insensitive functional unique index,
--   * must_change_password / is_active / password_reset_at,
--   * no password/hash stored here (auth lives in auth.users).
--
-- Does NOT: create auth users / RAM accounts / seed rows, add RLS policies,
--           add a district relation on rams, add a total_participants column,
--           add a "personel" (staff) field, or touch ANY existing table
--           (admin_profiles, school_accounts, schools, risk-map tables,
--           existing functions/triggers/policies stay untouched).
-- No secret / service_role values are stored here.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: rams
-- RAM institutions. No district relation (per requirements). Name uniqueness
-- is enforced case-insensitively via a functional unique index below.
-- ---------------------------------------------------------------------
CREATE TABLE public.rams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive RAM name uniqueness (same simple/safe approach as
-- school_accounts.username: a UNIQUE functional index on lower(name)).
-- No citext extension is added (keeps parity with the existing project).
CREATE UNIQUE INDEX ux_rams_name_ci
    ON public.rams (lower(name));

-- ---------------------------------------------------------------------
-- TABLE: ram_accounts
-- One institutional login account per RAM, linked to a Supabase Auth user.
-- RAM counterpart of school_accounts. No password/hash stored here.
-- ---------------------------------------------------------------------
CREATE TABLE public.ram_accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ram_id               UUID NOT NULL UNIQUE
                         REFERENCES public.rams(id) ON DELETE RESTRICT,

    auth_user_id         UUID NOT NULL UNIQUE
                         REFERENCES auth.users(id) ON DELETE RESTRICT,

    username             TEXT NOT NULL UNIQUE,

    is_active            BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    password_reset_at    TIMESTAMPTZ NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive username uniqueness (mirrors school_accounts).
CREATE UNIQUE INDEX ux_ram_accounts_username_ci
    ON public.ram_accounts (lower(username));

-- ---------------------------------------------------------------------
-- TABLE: ram_activities
-- RAM Çalışmaları records. Each row is bound to a RAM via ram_id (set
-- server-side from the logged-in RAM Admin's token, never from the client).
-- total_participants is intentionally NOT stored; it is computed in the
-- backend as student_count + teacher_count + parent_count. No staff field.
-- ---------------------------------------------------------------------
CREATE TABLE public.ram_activities (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ram_id            UUID NOT NULL
                      REFERENCES public.rams(id) ON DELETE RESTRICT,

    activity_date     DATE NOT NULL,

    district_id       SMALLINT NOT NULL
                      REFERENCES public.districts(id) ON DELETE RESTRICT,

    institution_name  TEXT NOT NULL,
    activity_type     TEXT NOT NULL,
    title             TEXT NOT NULL,

    target_type       TEXT NOT NULL
                      CHECK (target_type IN ('genel_hedef', 'yerel_hedef', 'ozel_hedef', 'hedef_disi')),

    student_count     INTEGER NOT NULL DEFAULT 0 CHECK (student_count >= 0),
    teacher_count     INTEGER NOT NULL DEFAULT 0 CHECK (teacher_count >= 0),
    parent_count      INTEGER NOT NULL DEFAULT 0 CHECK (parent_count  >= 0),

    note              TEXT NULL,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes: only what real query patterns need.
CREATE INDEX ix_ram_activities_ram_id       ON public.ram_activities (ram_id);
CREATE INDEX ix_ram_activities_district_id  ON public.ram_activities (district_id);
CREATE INDEX ix_ram_activities_date         ON public.ram_activities (activity_date);
-- Composite for the primary access path: a RAM's own records over a date range.
CREATE INDEX ix_ram_activities_ram_date     ON public.ram_activities (ram_id, activity_date);

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance via BEFORE UPDATE triggers.
-- Table-specific function names (parity with Migrations 006/009/013).
-- Backend never has to set updated_at manually.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_rams_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rams_set_updated_at ON public.rams;
CREATE TRIGGER rams_set_updated_at
    BEFORE UPDATE ON public.rams
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_rams_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_ram_accounts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ram_accounts_set_updated_at ON public.ram_accounts;
CREATE TRIGGER ram_accounts_set_updated_at
    BEFORE UPDATE ON public.ram_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_ram_accounts_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_ram_activities_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ram_activities_set_updated_at ON public.ram_activities;
CREATE TRIGGER ram_activities_set_updated_at
    BEFORE UPDATE ON public.ram_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_ram_activities_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (NO policies yet — deferred).
-- With RLS enabled and no policies, only the table owner and the
-- service_role (which bypasses RLS) can access rows. All access is
-- routed through the backend service client + authorization helpers,
-- exactly like the existing tables.
-- ---------------------------------------------------------------------
ALTER TABLE public.rams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ram_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ram_activities ENABLE ROW LEVEL SECURITY;

COMMIT;
