-- =====================================================================
-- Migration 006: School Accounts — base infrastructure
-- Scope (STRICT): school_accounts table + updated_at trigger + RLS enable
--                 + current_school_id() helper ONLY.
--
-- Does NOT: create auth users, school accounts, seed rows, admin tables,
--           passwords/hashes, RLS policies, or touch existing tables/data.
-- No secret / service_role values are stored here.
--
-- NOTE on is_ram_admin(): intentionally NOT created in this migration.
-- It must resolve against a future RAM admin structure (admin_profiles),
-- which does NOT exist yet. Creating a fake/temporary table is forbidden,
-- so this function is deferred to a later migration. (See report.)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: school_accounts
-- One login account per school, linked to a Supabase Auth user.
-- No password / hash is ever stored here (auth lives in auth.users).
-- ---------------------------------------------------------------------
CREATE TABLE public.school_accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id            UUID NOT NULL UNIQUE
                         REFERENCES public.schools(id) ON DELETE RESTRICT,

    auth_user_id         UUID NOT NULL UNIQUE
                         REFERENCES auth.users(id) ON DELETE RESTRICT,

    username             TEXT NOT NULL UNIQUE,

    is_active            BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    password_reset_at    TIMESTAMPTZ NULL,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Case-insensitive username uniqueness.
-- Simple + safe PostgreSQL approach: a UNIQUE functional index on
-- lower(username). This makes 'ataturkortaokulu' and 'AtaturkOrtaokulu'
-- collide (the second insert fails). It also subsumes exact-match
-- uniqueness. The column-level UNIQUE above is kept per the data
-- dictionary; this index adds the case-insensitive guarantee.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX ux_school_accounts_username_ci
    ON public.school_accounts (lower(username));

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance via BEFORE UPDATE trigger.
-- Backend never has to set updated_at manually.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_school_accounts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.school_accounts;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.school_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_school_accounts_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later migration).
-- With RLS enabled and no policies, only the table owner and the
-- service_role (which bypasses RLS) can access rows.
-- ---------------------------------------------------------------------
ALTER TABLE public.school_accounts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Helper: current_school_id()
-- Returns the school_id of the ACTIVE school account bound to the
-- current authenticated user (auth.uid()); NULL if none.
-- SECURITY DEFINER so it can be used inside future RLS policies on other
-- tables without being blocked by school_accounts' own RLS.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT sa.school_id
    FROM public.school_accounts sa
    WHERE sa.auth_user_id = auth.uid()
      AND sa.is_active = true
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_school_id() TO authenticated;

COMMIT;
