-- =====================================================================
-- Migration 015: ram_districts — RAM <-> district responsibility mapping
-- Scope (STRICT): create ONE new table (ram_districts) + its UNIQUE
--                 constraint + index + RLS enable (NO policies).
--
-- Purpose: link RAM institutions to the districts they are responsible for.
-- A RAM may be responsible for MANY districts; a district belongs to EXACTLY
-- ONE RAM (enforced by UNIQUE(district_id)). The relation is district-based,
-- NOT school-based. Risk Map visibility for a RAM is resolved DYNAMICALLY:
--     submission -> school -> district -> ram_districts -> ram
-- so NO ram_id is added to school_submissions / schools / districts, and past
-- submissions become visible automatically once this mapping is populated.
--
-- Real data types (verified against the live schema):
--   * rams.id       = UUID          (Migration 014)
--   * districts.id  = SMALLINT       (Migration 002)
--
-- Does NOT: seed rows (see the commented, name-lookup template AFTER COMMIT —
--           it is NOT executed by this migration), add RLS policies, alter ANY
--           existing table (schools / districts / school_submissions / snapshot
--           tables / rams / ram_accounts / ram_activities stay untouched),
--           touch existing functions/triggers/policies. No secret / service_role
--           values are stored here.
-- Result: ram_districts RLS = ON, policy count = 0.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- TABLE: ram_districts
-- One row per (RAM, district) responsibility link.
--   * ram_id      -> rams(id)      ON DELETE CASCADE  (drop links with the RAM)
--   * district_id -> districts(id) ON DELETE RESTRICT (protect referenced data)
--   * UNIQUE(district_id) => a district can map to AT MOST ONE RAM, which also
--     guarantees no double-counting in RAM aggregate statistics.
-- ---------------------------------------------------------------------
CREATE TABLE public.ram_districts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ram_id      UUID     NOT NULL
                REFERENCES public.rams(id) ON DELETE CASCADE,

    district_id SMALLINT NOT NULL
                REFERENCES public.districts(id) ON DELETE RESTRICT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_ram_districts_district UNIQUE (district_id)
);

-- A RAM's responsible-district lookup is the primary access path.
CREATE INDEX ix_ram_districts_ram_id ON public.ram_districts (ram_id);

-- ---------------------------------------------------------------------
-- RLS: enable now (NO policies yet — deferred), same pattern as
-- rams / ram_accounts / ram_activities. With RLS enabled and no policies,
-- only the table owner and the service_role (which bypasses RLS) can access
-- rows. All access is routed through the backend service client +
-- authorization helpers.
-- ---------------------------------------------------------------------
ALTER TABLE public.ram_districts ENABLE ROW LEVEL SECURITY;

COMMIT;

-- =====================================================================
-- SEED TEMPLATE — *** NOT EXECUTED BY THIS MIGRATION ***
-- ---------------------------------------------------------------------
-- The 5 RAMs below (Yüreğir / Ceyhan / Seyhan / Sarıçam / Kozan) DO NOT yet
-- exist in the live `rams` table. Only ONE RAM currently exists:
--     'Çukurova Rehberlik ve Araştırma Merkezi'
-- The task's short labels ("Çukurova RAM", "Kozan RAM", ...) are NOT the real
-- DB names. To avoid creating WRONG links, no seed is executed here.
--
-- HOW TO SEED SAFELY (run manually ONLY AFTER all 6 RAMs exist with their real
-- names, and after you replace each '<<< REAL RAM NAME >>>' with the exact
-- value from public.rams.name):
--
--   * The INSERT ... SELECT joins by NAME, so a typo / missing name simply
--     produces NO row instead of a wrong link.
--   * ON CONFLICT (district_id) DO NOTHING keeps it re-runnable and lets
--     UNIQUE(district_id) block accidental double mapping.
--   * The 15 district names below match the live `districts` table exactly.
--
-- BEGIN;
--
-- INSERT INTO public.ram_districts (ram_id, district_id)
-- SELECT r.id, d.id
-- FROM (VALUES
--     -- (RAM real name from public.rams.name , district name from districts)
--     ('<<< YÜREĞİR RAM REAL NAME >>>'                , 'Yüreğir'),
--     ('<<< YÜREĞİR RAM REAL NAME >>>'                , 'Karataş'),
--     ('<<< CEYHAN RAM REAL NAME >>>'                 , 'Ceyhan'),
--     ('<<< CEYHAN RAM REAL NAME >>>'                 , 'Yumurtalık'),
--     ('<<< SEYHAN RAM REAL NAME >>>'                 , 'Seyhan'),
--     ('<<< SARIÇAM RAM REAL NAME >>>'                , 'Sarıçam'),
--     ('<<< KOZAN RAM REAL NAME >>>'                  , 'Kozan'),
--     ('<<< KOZAN RAM REAL NAME >>>'                  , 'Tufanbeyli'),
--     ('<<< KOZAN RAM REAL NAME >>>'                  , 'Saimbeyli'),
--     ('<<< KOZAN RAM REAL NAME >>>'                  , 'Feke'),
--     ('<<< KOZAN RAM REAL NAME >>>'                  , 'Aladağ'),
--     ('<<< KOZAN RAM REAL NAME >>>'                  , 'İmamoğlu'),
--     ('Çukurova Rehberlik ve Araştırma Merkezi'      , 'Çukurova'),
--     ('Çukurova Rehberlik ve Araştırma Merkezi'      , 'Pozantı'),
--     ('Çukurova Rehberlik ve Araştırma Merkezi'      , 'Karaisalı')
-- ) AS m(ram_name, district_name)
-- JOIN public.rams      r ON lower(r.name) = lower(m.ram_name)
-- JOIN public.districts d ON d.name = m.district_name
-- ON CONFLICT (district_id) DO NOTHING;
--
-- -- Verification: expect 15 mapped districts and 0 unmapped once all 6 RAMs
-- -- exist and names are correct.
-- -- SELECT count(*) AS mapped FROM public.ram_districts;
-- -- SELECT d.name FROM public.districts d
-- --   LEFT JOIN public.ram_districts rd ON rd.district_id = d.id
-- --   WHERE rd.id IS NULL ORDER BY d.name;   -- should return no rows
--
-- COMMIT;
-- =====================================================================
