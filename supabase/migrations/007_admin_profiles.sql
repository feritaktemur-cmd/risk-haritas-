-- =====================================================================
-- Migration 007: RAM Admin authority base infrastructure
-- Scope (STRICT): admin_profiles table + updated_at trigger + RLS enable
--                 + helper functions (is_ram_admin, is_general_admin,
--                 current_admin_district_id) ONLY.
--
-- Does NOT: create real admin accounts / seed admins / auth users /
--           passwords / emails, no frontend/backend/API, no login,
--           no CRUD policies. Does NOT touch Migration 006 objects,
--           school_accounts, or existing school/district data.
-- No secret / service_role values stored here.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: admin_profiles
-- Two RAM admin levels: 'general_admin' (all of Adana, no district) and
-- 'district_admin' (scoped to a single district). No password/hash here;
-- auth lives in auth.users.
-- ---------------------------------------------------------------------
CREATE TABLE public.admin_profiles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    auth_user_id UUID NOT NULL UNIQUE
                 REFERENCES auth.users(id) ON DELETE RESTRICT,

    full_name    TEXT NOT NULL,

    role         TEXT NOT NULL,

    district_id  SMALLINT NULL
                 REFERENCES public.districts(id) ON UPDATE CASCADE ON DELETE RESTRICT,

    is_active    BOOLEAN NOT NULL DEFAULT true,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Role must be exactly one of the two supported levels.
    CONSTRAINT chk_admin_profiles_role
        CHECK (role IN ('general_admin', 'district_admin')),

    -- Role <-> district integrity (DB-enforced, no trigger needed):
    --   general_admin  => district_id IS NULL     (not scoped to a district)
    --   district_admin => district_id IS NOT NULL (scoped to one district)
    CONSTRAINT chk_admin_profiles_role_district
        CHECK (
            (role = 'general_admin'  AND district_id IS NULL)
            OR
            (role = 'district_admin' AND district_id IS NOT NULL)
        )
);

-- ---------------------------------------------------------------------
-- updated_at auto-maintenance via BEFORE UPDATE trigger (table-specific
-- names). Backend never has to set updated_at manually.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_admin_profiles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_profiles_set_updated_at ON public.admin_profiles;
CREATE TRIGGER admin_profiles_set_updated_at
    BEFORE UPDATE ON public.admin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_admin_profiles_set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: enable now (no policies yet — deferred to a later migration).
-- With RLS enabled and no policies, only the table owner and the
-- service_role (which bypasses RLS) can access rows.
-- ---------------------------------------------------------------------
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Helper functions (for future RLS policies).
-- Security approach mirrors Migration 006's current_school_id():
--   SECURITY DEFINER (so they work inside other tables' RLS policies
--   without being blocked by admin_profiles' own RLS),
--   STABLE, SET search_path = '', all objects fully schema-qualified.
--   Execution locked down: revoked from PUBLIC/anon, granted only to
--   authenticated. No service_role grant (service-key flows bypass RLS).
-- ---------------------------------------------------------------------

-- is_ram_admin(): active admin (either role) for current auth.uid()?
CREATE OR REPLACE FUNCTION public.is_ram_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_profiles ap
        WHERE ap.auth_user_id = auth.uid()
          AND ap.is_active = true
          AND ap.role IN ('general_admin', 'district_admin')
    );
$$;

REVOKE ALL ON FUNCTION public.is_ram_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_ram_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_ram_admin() TO authenticated;

-- is_general_admin(): active general_admin for current auth.uid()?
CREATE OR REPLACE FUNCTION public.is_general_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_profiles ap
        WHERE ap.auth_user_id = auth.uid()
          AND ap.is_active = true
          AND ap.role = 'general_admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_general_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_general_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_general_admin() TO authenticated;

-- current_admin_district_id(): district_id if current user is an active
-- district_admin; NULL for general_admin or non-admin users.
CREATE OR REPLACE FUNCTION public.current_admin_district_id()
RETURNS SMALLINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT ap.district_id
    FROM public.admin_profiles ap
    WHERE ap.auth_user_id = auth.uid()
      AND ap.is_active = true
      AND ap.role = 'district_admin'
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_admin_district_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_admin_district_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_admin_district_id() TO authenticated;

COMMIT;
