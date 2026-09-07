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
-- Does NOT: add RLS policies, alter ANY existing table (schools / districts /
--           school_submissions / snapshot tables / rams / ram_accounts /
--           ram_activities stay untouched), touch existing functions/triggers/
--           policies. No secret / service_role values are stored here.
-- Includes: a district->RAM seed (15 districts -> 6 RAMs) resolved by real
--           names (no hard-coded IDs) with a strict verify-or-rollback guard.
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
-- SEED: district -> RAM mapping (15 districts -> 6 RAMs)
-- ---------------------------------------------------------------------
-- All 6 RAMs now exist in public.rams. IDs are NOT hard-coded: they are
-- resolved by joining on the REAL rams.name (verified from the live DB) and
-- districts.name (all 15 verified present). A typo / missing name produces NO
-- row (JOIN drops it) instead of a wrong link, and ON CONFLICT (district_id)
-- DO NOTHING keeps it re-runnable while UNIQUE(district_id) blocks any
-- accidental double mapping. A strict verification block at the end forces a
-- ROLLBACK (via an exception) unless the result is EXACTLY 15 links across
-- 15 distinct districts and 6 distinct RAMs.
--
-- Verified real RAM names (public.rams.name):
--   Yüreğir Rehberlik ve Araştırma Merkezi
--   Ceyhan  Rehberlik ve Araştırma Merkezi
--   Seyhan  Rehberlik ve Araştırma Merkezi
--   Sarıçam Rehberlik ve Araştırma Merkezi
--   Kozan   Rehberlik ve Araştırma Merkezi
--   Çukurova Rehberlik ve Araştırma Merkezi
-- =====================================================================

BEGIN;

INSERT INTO public.ram_districts (ram_id, district_id)
SELECT r.id, d.id
FROM (VALUES
    -- (real RAM name from public.rams.name          , district name)
    ('Yüreğir Rehberlik ve Araştırma Merkezi'         , 'Yüreğir'),
    ('Yüreğir Rehberlik ve Araştırma Merkezi'         , 'Karataş'),
    ('Ceyhan Rehberlik ve Araştırma Merkezi'          , 'Ceyhan'),
    ('Ceyhan Rehberlik ve Araştırma Merkezi'          , 'Yumurtalık'),
    ('Seyhan Rehberlik ve Araştırma Merkezi'          , 'Seyhan'),
    ('Sarıçam Rehberlik ve Araştırma Merkezi'         , 'Sarıçam'),
    ('Kozan Rehberlik ve Araştırma Merkezi'           , 'Kozan'),
    ('Kozan Rehberlik ve Araştırma Merkezi'           , 'Tufanbeyli'),
    ('Kozan Rehberlik ve Araştırma Merkezi'           , 'Saimbeyli'),
    ('Kozan Rehberlik ve Araştırma Merkezi'           , 'Feke'),
    ('Kozan Rehberlik ve Araştırma Merkezi'           , 'Aladağ'),
    ('Kozan Rehberlik ve Araştırma Merkezi'           , 'İmamoğlu'),
    ('Çukurova Rehberlik ve Araştırma Merkezi'        , 'Çukurova'),
    ('Çukurova Rehberlik ve Araştırma Merkezi'        , 'Pozantı'),
    ('Çukurova Rehberlik ve Araştırma Merkezi'        , 'Karaisalı')
) AS m(ram_name, district_name)
JOIN public.rams      r ON lower(r.name) = lower(m.ram_name)
JOIN public.districts d ON d.name = m.district_name
ON CONFLICT (district_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Strict verification: exactly 15 links, 15 distinct districts, 6 distinct
-- RAMs. Any deviation raises an exception -> the whole seed transaction rolls
-- back, so a wrong/partial mapping can NEVER silently look successful.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_total    INTEGER;
    v_district INTEGER;
    v_ram      INTEGER;
BEGIN
    SELECT count(*), count(DISTINCT district_id), count(DISTINCT ram_id)
      INTO v_total, v_district, v_ram
      FROM public.ram_districts;

    IF v_total <> 15 OR v_district <> 15 OR v_ram <> 6 THEN
        RAISE EXCEPTION
            'ram_districts seed dogrulamasi basarisiz: toplam=% (beklenen 15), farkli ilce=% (beklenen 15), farkli RAM=% (beklenen 6). Islem geri alindi.',
            v_total, v_district, v_ram;
    END IF;
END $$;

COMMIT;

