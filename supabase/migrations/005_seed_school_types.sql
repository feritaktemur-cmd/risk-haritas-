-- =====================================================================
-- Migration 005: seed school_types (Adana first release)
-- Scope (STRICT): seed data into existing school_types table ONLY.
-- No new table, no structure change.
-- education_level_id is resolved via subquery on education_levels.name
-- (NOT hard-coded).
-- No "Tümü" record. No İlçe MEM / RAM / BİLSEM / Halk Eğitimi Merkezi.
-- No "Anadolu Meslek Programı".
-- Respects UNIQUE (education_level_id, name); idempotent via ON CONFLICT.
-- No RLS/views/triggers/functions. Auth/Storage untouched.
-- =====================================================================

BEGIN;

-- ---- OKUL ÖNCESİ ----------------------------------------------------
INSERT INTO school_types (education_level_id, name)
SELECT (SELECT id FROM education_levels WHERE name = 'Okul Öncesi'), t.name
FROM (VALUES
    ('Anaokulu')
) AS t(name)
ON CONFLICT (education_level_id, name) DO NOTHING;

-- ---- İLKOKUL --------------------------------------------------------
INSERT INTO school_types (education_level_id, name)
SELECT (SELECT id FROM education_levels WHERE name = 'İlkokul'), t.name
FROM (VALUES
    ('İlkokul'),
    ('İlkokul (Görme Engelliler)'),
    ('İlkokul (İşitme Engelliler)')
) AS t(name)
ON CONFLICT (education_level_id, name) DO NOTHING;

-- ---- ORTAOKUL -------------------------------------------------------
INSERT INTO school_types (education_level_id, name)
SELECT (SELECT id FROM education_levels WHERE name = 'Ortaokul'), t.name
FROM (VALUES
    ('Ortaokul'),
    ('İmam Hatip Ortaokulu'),
    ('Müzik Ortaokulu'),
    ('Spor Ortaokulu'),
    ('Yatılı Bölge Ortaokulu'),
    ('Ortaokul (Görme Engelliler)'),
    ('Ortaokul (İşitme Engelliler)')
) AS t(name)
ON CONFLICT (education_level_id, name) DO NOTHING;

-- ---- LİSE -----------------------------------------------------------
INSERT INTO school_types (education_level_id, name)
SELECT (SELECT id FROM education_levels WHERE name = 'Lise'), t.name
FROM (VALUES
    ('Anadolu Lisesi'),
    ('Fen Lisesi'),
    ('Sosyal Bilimler Lisesi'),
    ('Güzel Sanatlar Lisesi'),
    ('Spor Lisesi'),
    ('Anadolu İmam Hatip Lisesi'),
    ('Mesleki ve Teknik Anadolu Lisesi'),
    ('Çok Programlı Anadolu Lisesi'),
    ('Mesleki Eğitim Merkezi')
) AS t(name)
ON CONFLICT (education_level_id, name) DO NOTHING;

-- ---- ÖZEL EĞİTİM ----------------------------------------------------
INSERT INTO school_types (education_level_id, name)
SELECT (SELECT id FROM education_levels WHERE name = 'Özel Eğitim'), t.name
FROM (VALUES
    ('Özel Eğitim Anaokulu'),
    ('Özel Eğitim Uygulama Okulu (I. Kademe)'),
    ('Özel Eğitim Uygulama Okulu (II. Kademe)'),
    ('Özel Eğitim Uygulama Okulu (III. Kademe)'),
    ('Özel Eğitim Meslek Okulu')
) AS t(name)
ON CONFLICT (education_level_id, name) DO NOTHING;

COMMIT;
