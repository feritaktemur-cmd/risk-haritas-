-- Türkçe 1. sınıf hazırlık aktarımı — SALT-OKUNUR doğrulama. Hiçbir veri yazmaz.
-- Her kontrol bir satır döndürür: kontrol | beklenen | bulunan | sonuç
WITH v AS (SELECT v.id FROM public.curriculum_versions v JOIN public.curriculum_subjects s ON s.id = v.subject_id
           WHERE s.code = 'TR' AND v.version_code = 'TYMM-2024-TR'),
g AS (SELECT g.* FROM public.curriculum_grades g WHERE g.version_id = (SELECT id FROM v) AND g.grade = 1),
b AS (SELECT b.* FROM public.curriculum_import_batches b WHERE b.version_id = (SELECT id FROM v)),
checks(kontrol, beklenen, bulunan) AS (VALUES
 ('surum_sayisi', 1, (SELECT count(*) FROM v)::int),
 ('surum_taslak', 1, (SELECT count(*) FROM public.curriculum_versions WHERE id = (SELECT id FROM v) AND status = 'draft' AND component_authority IS NULL)::int),
 ('sinif_taslak', 1, (SELECT count(*) FROM g WHERE status = 'draft' AND expected_outcome_count IS NULL)::int),
 ('parti_sayisi', 1, (SELECT count(*) FROM b)::int),
 ('parti_row_count', 285, (SELECT row_count FROM b)),
 ('parti_hata_sayisi', 0, (SELECT error_count FROM b)),
 ('ham_satir', 285, (SELECT count(*) FROM public.curriculum_import_rows WHERE batch_id = (SELECT id FROM b))::int),
 ('ham_satir_uyari', 16, (SELECT count(*) FROM public.curriculum_import_rows WHERE batch_id = (SELECT id FROM b) AND row_status = 'warning')::int),
 ('ham_satir_hata', 0, (SELECT count(*) FROM public.curriculum_import_rows WHERE batch_id = (SELECT id FROM b) AND row_status = 'error')::int),
 ('kaynak_belge_theme_page', 8, (SELECT count(*) FROM public.curriculum_source_documents WHERE version_id = (SELECT id FROM v) AND doc_type = 'theme_page' AND grade = 1)::int),
 ('tema', 8, (SELECT count(*) FROM public.curriculum_themes WHERE grade_id = (SELECT id FROM g))::int),
 ('tema_kazanim', 96, (SELECT count(*) FROM public.curriculum_theme_outcomes WHERE grade_id = (SELECT id FROM g))::int),
 ('tekil_tema_kodu', 17, (SELECT count(DISTINCT published_code_key) FROM public.curriculum_theme_outcomes WHERE grade_id = (SELECT id FROM g))::int),
 ('tema_bilesen', 285, (SELECT count(*) FROM public.curriculum_theme_components c JOIN public.curriculum_theme_outcomes t ON t.id = c.theme_outcome_id WHERE t.grade_id = (SELECT id FROM g))::int),
 ('islenmemis_ham_satir', 0, (SELECT count(*) FROM public.curriculum_import_rows r WHERE r.batch_id = (SELECT id FROM b)
     AND NOT EXISTS (SELECT 1 FROM public.curriculum_theme_components c WHERE c.import_row_id = r.id))::int),
 ('baska_partiden_kayit', 0, (SELECT count(*) FROM public.curriculum_theme_components c JOIN public.curriculum_import_rows r ON r.id = c.import_row_id
     JOIN public.curriculum_theme_outcomes t ON t.id = c.theme_outcome_id WHERE t.grade_id = (SELECT id FROM g) AND r.batch_id <> (SELECT id FROM b))::int),
 ('kazanim_metni_ham_ile_farkli', 0, (SELECT count(*) FROM public.curriculum_theme_outcomes t JOIN public.curriculum_import_rows r ON r.id = t.import_row_id
     WHERE t.grade_id = (SELECT id FROM g) AND (r.raw_values ->> t.source_field IS DISTINCT FROM t.published_text OR r.published_code IS DISTINCT FROM t.published_code))::int),
 ('bilesen_metni_ham_ile_farkli', 0, (SELECT count(*) FROM public.curriculum_theme_components c JOIN public.curriculum_import_rows r ON r.id = c.import_row_id
     JOIN public.curriculum_theme_outcomes t ON t.id = c.theme_outcome_id
     WHERE t.grade_id = (SELECT id FROM g) AND (r.raw_values ->> c.source_field IS DISTINCT FROM c.published_text OR r.published_label IS DISTINCT FROM c.published_label))::int),
 ('tema_satir_tutarsizligi', 0, (SELECT count(*) FROM public.curriculum_theme_components c JOIN public.curriculum_import_rows r ON r.id = c.import_row_id
     JOIN public.curriculum_themes th ON th.id = c.theme_id JOIN public.curriculum_theme_outcomes t ON t.id = c.theme_outcome_id
     WHERE t.grade_id = (SELECT id FROM g) AND (r.theme_no <> th.theme_no OR r.published_code <> t.published_code))::int),
 ('eslesmemis_olmayan_kayit', 0, ((SELECT count(*) FROM public.curriculum_theme_outcomes WHERE grade_id = (SELECT id FROM g) AND mapping_status <> 'unmapped')
     + (SELECT count(*) FROM public.curriculum_theme_components c JOIN public.curriculum_theme_outcomes t ON t.id = c.theme_outcome_id
        WHERE t.grade_id = (SELECT id FROM g) AND c.mapping_status <> 'unmapped'))::int),
 ('kanonik_kazanim', 0, (SELECT count(*) FROM public.curriculum_outcomes WHERE grade_id = (SELECT id FROM g))::int),
 ('karar_kaydi', 0, (SELECT count(*) FROM public.curriculum_review_decisions WHERE version_id = (SELECT id FROM v))::int),
 ('ogretmen_katalogu', 0, (SELECT count(*) FROM public.curriculum_teacher_catalog WHERE version_id = (SELECT id FROM v))::int)
)
SELECT kontrol, beklenen, bulunan, CASE WHEN beklenen = bulunan THEN 'GEÇTİ' ELSE 'KALDI' END AS sonuc FROM checks;
