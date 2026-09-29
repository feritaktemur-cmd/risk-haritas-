-- ============================================================
-- Migration 031: RİBA öğrenci kodu zorunluluğunu kaldır
-- Yeni kilitlenen katılım modelinde öğrenci kodu kullanılmaz; öğrenci
-- yanıtları anonimdir ve student_code_id = NULL ile kaydedilir. Artık
-- student, parent ve teacher response'larının tamamında student_code_id
-- NULL olmak zorundadır.
-- Bu migration YALNIZCA chk_riba_responses_student_code constraint'ini
-- değiştirir; riba_student_codes, student_code_id kolonu,
-- uq_riba_responses_student_code, chk_riba_responses_device_token ve
-- uq_riba_responses_device_submission dokunulmaz.
-- ============================================================
BEGIN;

ALTER TABLE public.riba_responses
DROP CONSTRAINT chk_riba_responses_student_code;

ALTER TABLE public.riba_responses
ADD CONSTRAINT chk_riba_responses_student_code
CHECK (student_code_id IS NULL);

COMMIT;
