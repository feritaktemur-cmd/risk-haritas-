-- 035: dna_check_response_complete fonksiyonunu depodaki 033 tanımıyla eşitler.
-- Neden: canlıdaki eski taslak NEW.id / NEW.response_id alanlarına doğrudan erişiyordu;
-- dna_answers satırında "id", dna_responses satırında "response_id" olmadığı için
-- her yanıt gönderimi 42703 (record "new" has no field ...) hatasıyla geri alınıyordu.
-- Kapsam: YALNIZCA bu fonksiyonun gövdesi. Tablo, veri, RLS, yetki, tetikleyici ve
-- diğer fonksiyonlar değişmez. CREATE OR REPLACE sahipliği, yetkileri ve tetikleyici
-- bağlantılarını korur.
BEGIN;

DO $$
BEGIN
 IF to_regprocedure('public.dna_check_response_complete()') IS NULL THEN
   RAISE EXCEPTION '035: 033_dna_foundation uygulanmamış (dna_check_response_complete yok)';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.dna_check_response_complete() RETURNS trigger
 LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 rid uuid := CASE WHEN TG_TABLE_NAME = 'dna_responses' THEN (to_jsonb(NEW) ->> 'id')::uuid
                   ELSE (to_jsonb(NEW) ->> 'response_id')::uuid END;
 expected integer;
 answer_count integer;
 answer_sum integer;
 stored_total integer;
BEGIN
 SELECT c.item_count, r.total_score INTO expected, stored_total
 FROM public.dna_responses r
 JOIN public.dna_applications a ON a.id = r.application_id
 JOIN public.dna_catalogs c ON c.id = a.catalog_id
 WHERE r.id = rid;
 SELECT count(*), coalesce(sum(x.value), 0) INTO answer_count, answer_sum
 FROM public.dna_answers x WHERE x.response_id = rid;
 IF answer_count <> expected OR answer_sum <> stored_total THEN
   RAISE EXCEPTION 'DNA response must have exactly % answers and a matching total score', expected;
 END IF;
 RETURN NULL;
END $$;

DO $$
BEGIN
 IF position('to_jsonb(NEW)' IN (SELECT prosrc FROM pg_proc WHERE oid = 'public.dna_check_response_complete()'::regprocedure)) = 0 THEN
   RAISE EXCEPTION '035: dna_check_response_complete güncellenemedi';
 END IF;
END $$;

COMMIT;
