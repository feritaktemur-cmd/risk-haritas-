-- PDRPUSULA / DNA / Migration 034 — Resmî DNA katalog seed'i
-- DURUM: UYGULANMADI. Kullanıcı Supabase SQL Editor'da (postgres rolü) çalıştırır. Önkoşul: 033 uygulanmış olmalı.
-- Kaynak: DNA_MEB_Anket_ve_Sonuc_Cizelgesi_Tam_Katalog.json (sha256 888b85ed665ff0a07d2e662d2f9ee1d952f50d51a445a483e7a4ab1bf95d52e7)
--   Form: 08131422_devamsizliknedenianketi.pdf — MEB Özel Eğitim ve Rehberlik Hizmetleri Genel Müdürlüğü
--   Sonuç çizelgesi: 15172909_devamsizliknedenlerianketisinifokulsonuccizelgesi.xlsx
-- İçerik: 1 katalog, 7 boyut, 51 puanlanan madde. 52. madde açık uçludur, puanlanmaz; katalogda open_text_prompt olarak tutulur.
-- Puanlama 033'te sabittir (dna_answers.value 0..2): Evet = 2, Bazen = 1, Hayır = 0.
-- Katalog pasif eklenir, doğrulanır, doğrulama geçerse aktifleştirilir. Herhangi bir hata tüm işlemi geri alır.
-- Mevcut hiçbir tablo, 033 veya başka modül değiştirilmez.

BEGIN;

DO $$
BEGIN
 IF to_regclass('public.dna_catalogs') IS NULL OR to_regclass('public.dna_dimensions') IS NULL
    OR to_regclass('public.dna_items') IS NULL THEN
   RAISE EXCEPTION '034: 033_dna_foundation uygulanmamış';
 END IF;
 IF EXISTS (SELECT 1 FROM public.dna_catalogs WHERE catalog_code = 'meb_orgm_devamsizlik_nedenleri_anketi' AND catalog_version = 'official-form-and-result-sheet-1.1') THEN
   RAISE EXCEPTION '034: bu katalog sürümü zaten mevcut';
 END IF;
 IF EXISTS (SELECT 1 FROM public.dna_catalogs WHERE is_active) THEN
   RAISE EXCEPTION '034: başka bir aktif DNA kataloğu var; işlem durduruldu';
 END IF;
END $$;

INSERT INTO public.dna_catalogs
 (catalog_code, catalog_version, source_file, result_sheet_file, item_count, dimension_count,
  open_text_prompt, open_text_max_length, is_active)
VALUES
 ('meb_orgm_devamsizlik_nedenleri_anketi', 'official-form-and-result-sheet-1.1', '08131422_devamsizliknedenianketi.pdf', '15172909_devamsizliknedenlerianketisinifokulsonuccizelgesi.xlsx', 51, 7,
  'Belirtmek istediğiniz diğer nedenler varsa yazınız.', 2000, false);

INSERT INTO public.dna_dimensions (catalog_id, dimension_no, name, first_item, last_item, item_count)
SELECT c.id, v.dimension_no, v.name, v.first_item, v.last_item, v.item_count
FROM public.dna_catalogs c
CROSS JOIN (VALUES
 (1, 'Okul ve Yönetim', 1, 10, 10),
 (2, 'Öğretmen', 11, 17, 7),
 (3, 'Aile', 18, 26, 9),
 (4, 'Çevre', 27, 31, 5),
 (5, 'Akademik Kaygı', 32, 36, 5),
 (6, 'Kişisel Nedenler', 37, 45, 9),
 (7, 'Arkadaş Çevresi', 46, 51, 6)
) AS v(dimension_no, name, first_item, last_item, item_count)
WHERE c.catalog_code = 'meb_orgm_devamsizlik_nedenleri_anketi' AND c.catalog_version = 'official-form-and-result-sheet-1.1';

INSERT INTO public.dna_items (catalog_id, dimension_id, item_no, text, source_page)
SELECT c.id, dm.id, v.item_no, v.text, v.source_page
FROM public.dna_catalogs c
CROSS JOIN (VALUES
 (1, 1, 'İhtiyaç duyduğumda okul idaresi izin vermediği için', 1),
 (2, 1, 'Zor dersler aynı günde olduğunda', 1),
 (3, 1, 'Geç kaldığımda okul yöneticileriyle karşılaşmak istemediğim için', 1),
 (4, 1, 'Boş derslerde ve öğle aralarında okulda verimli zaman geçireceğim bir alan/mekan olmadığı için', 1),
 (5, 1, 'Giriş ve çıkış saatleri bana uygun olmadığı için', 1),
 (6, 1, 'Kılık kıyafetim uygun olmadığında (saç, sakal, takı, makyaj vb.) okul yönetiminden çekindiğim için', 1),
 (7, 1, 'Okul binası (rampa, asansör vb) fiziksel durumuma uygun olmadığı için', 1),
 (8, 1, 'Okulda günlük ders saati çok fazla olduğu için', 1),
 (9, 1, 'Okulun ilk ya da son haftalarında ders yapılmadığı için', 1),
 (10, 1, 'Okulda yeteneklerimi gösterebileceğim fırsatlar olmadığı için', 1),
 (11, 2, 'Öğretmenler aşırı disiplinli davrandığı için', 1),
 (12, 2, 'Bazı dersler çok sıkıcı geçtiği için', 1),
 (13, 2, 'Öğretmenler, benden derslerde yapabileceklerimden daha fazlasını yapmamı bekledikleri için', 1),
 (14, 2, 'Öğretmenler, okulda öğrencilere karşı sürekli küçük düşürücü davranışlarında bulundukları için', 1),
 (15, 2, 'Öğretmenler, öğrenciler arasında ayrımcılık yaptığı için', 1),
 (16, 2, 'Öğretmenlerim bana yakınlık göstermediği için', 1),
 (17, 2, 'Diğer öğrenciler dersin işlenmesine engel olduğu için', 1),
 (18, 3, 'Ailem, okula gidip gitmememi umursamadığı için', 1),
 (19, 3, 'Ders araç gerecim olmadığında', 1),
 (20, 3, 'Bazı günler harçlığım olmadığı için', 1),
 (21, 3, 'Bazı günler kıyafetlerim bakımsız (kirli, ütüsüz) olduğunda', 1),
 (22, 3, 'Aileme yardımcı olmam gereken günlerde', 1),
 (23, 3, 'Okul dışında bir işte çalışmak zorunda olduğum için', 1),
 (24, 3, 'Aile içinde sorunlarımız olduğu zamanlarda', 1),
 (25, 3, 'Evde misafir olduğu zaman', 1),
 (26, 3, 'Bir yakınım vefat ettiğinde', 1),
 (27, 4, 'Evim okula çok uzak olduğu için', 1),
 (28, 4, 'Havanın soğuk ya da yağışlı olduğu günlerde', 1),
 (29, 4, 'Özel kurs ve etütlere daha fazla zaman ayırdığım için', 1),
 (30, 4, 'Okul dışındaki etkinliklere katılmak için', 2),
 (31, 4, 'Okul yolu güvenli olmadığı için', 2),
 (32, 5, 'Ertesi günün sınavlarına çalışmak için', 2),
 (33, 5, 'Ödevlerimi yapmadığım günlerde', 2),
 (34, 5, 'Başarısız olduğum derslere katılmak istemediğim için', 2),
 (35, 5, 'Bir üst öğretim kurumunun sınavlarına hazırlanmamda okul dersleri yetersiz kaldığı için', 2),
 (36, 5, 'Okulu bitirince iş bulabileceğime inanmadığım için', 2),
 (37, 6, 'Okulumu sevmediğim için', 2),
 (38, 6, 'Hasta olduğum zaman', 2),
 (39, 6, 'Sabahları zamanında uyanamadığımda', 2),
 (40, 6, 'Yorucu geçen bir günden sonraki günü dinlenerek geçirmek istediğim için', 2),
 (41, 6, 'Dersin telafisi mümkün olduğunda', 2),
 (42, 6, 'Resmi tatillerden önceki ya da sonraki günlerde', 2),
 (43, 6, 'Bazı günler moralim bozuk olduğu için', 2),
 (44, 6, 'Okuldan kaçmak eğlenceli geldiği için', 2),
 (45, 6, 'Okula gitmesem de sınıfı geçeceğimi bildiğim için', 2),
 (46, 7, 'Arkadaşlarıma göre yaşça daha büyük olduğum için', 2),
 (47, 7, 'Okul saatinde, okul dışından arkadaşlarımla görüşmek için', 2),
 (48, 7, 'Arkadaşlarımla okuldan kaçma kararı aldığımızda', 2),
 (49, 7, 'Okulda arkadaşlarım tarafından dışlandığım için', 2),
 (50, 7, 'Okuldaki öğrenciler fiziksel veya duygusal olarak bana zarar verdiği için', 2),
 (51, 7, 'Okulda arkadaşlarımla anlaşamadığım için', 2)
) AS v(item_no, dimension_no, text, source_page)
JOIN public.dna_dimensions dm ON dm.dimension_no = v.dimension_no
WHERE c.catalog_code = 'meb_orgm_devamsizlik_nedenleri_anketi' AND c.catalog_version = 'official-form-and-result-sheet-1.1' AND dm.catalog_id = c.id;

-- Doğrulama: sayılar, aralıklar, sıralama ve metin parmak izi (kaynakla birebir).
DO $$
DECLARE
 v_cat uuid;
 v_item_fp text;
 v_dim_fp text;
BEGIN
 SELECT id INTO v_cat FROM public.dna_catalogs WHERE catalog_code = 'meb_orgm_devamsizlik_nedenleri_anketi' AND catalog_version = 'official-form-and-result-sheet-1.1';
 IF (SELECT count(*) FROM public.dna_dimensions WHERE catalog_id = v_cat) <> 7 THEN
   RAISE EXCEPTION '034 doğrulama: boyut sayısı 7 değil';
 END IF;
 IF (SELECT count(*) FROM public.dna_items WHERE catalog_id = v_cat) <> 51 THEN
   RAISE EXCEPTION '034 doğrulama: madde sayısı 51 değil';
 END IF;
 IF (SELECT array_agg(item_no ORDER BY item_no) FROM public.dna_items WHERE catalog_id = v_cat)
    <> (SELECT array_agg(g::smallint ORDER BY g) FROM generate_series(1, 51) g) THEN
   RAISE EXCEPTION '034 doğrulama: madde numaraları 1..51 değil';
 END IF;
 IF EXISTS (SELECT 1 FROM public.dna_items i JOIN public.dna_dimensions dm ON dm.id = i.dimension_id
            WHERE i.catalog_id = v_cat AND i.item_no NOT BETWEEN dm.first_item AND dm.last_item) THEN
   RAISE EXCEPTION '034 doğrulama: madde boyut aralığı dışında';
 END IF;
 IF EXISTS (SELECT 1 FROM public.dna_items WHERE catalog_id = v_cat AND (text IS NULL OR text <> btrim(text) OR text = '')) THEN
   RAISE EXCEPTION '034 doğrulama: eksik veya boşluklu madde metni';
 END IF;
 SELECT md5(string_agg(i.item_no || ':' || dm.dimension_no || ':' || i.text, E'\n' ORDER BY i.item_no)) INTO v_item_fp
 FROM public.dna_items i JOIN public.dna_dimensions dm ON dm.id = i.dimension_id WHERE i.catalog_id = v_cat;
 SELECT md5(string_agg(dimension_no || ':' || name || ':' || first_item || ':' || last_item || ':' || item_count, E'\n' ORDER BY dimension_no))
 INTO v_dim_fp FROM public.dna_dimensions WHERE catalog_id = v_cat;
 IF v_item_fp <> '3e6c60285f132e29e210f7a1f9727bdf' THEN
   RAISE EXCEPTION '034 doğrulama: madde metinleri kaynakla birebir değil (%)', v_item_fp;
 END IF;
 IF v_dim_fp <> 'bf273aba5b12547b8c3edfbb18ee70d9' THEN
   RAISE EXCEPTION '034 doğrulama: boyutlar kaynakla birebir değil (%)', v_dim_fp;
 END IF;
 IF NOT public.dna_catalog_is_complete(v_cat) THEN
   RAISE EXCEPTION '034 doğrulama: dna_catalog_is_complete = false';
 END IF;
 UPDATE public.dna_catalogs SET is_active = true WHERE id = v_cat;
 RAISE NOTICE '034: DNA kataloğu doğrulandı ve aktifleştirildi (7 boyut, 51 madde)';
END $$;

COMMIT;
