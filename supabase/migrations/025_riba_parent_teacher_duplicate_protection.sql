-- ============================================================
-- Migration 025: RİBA Parent/Teacher Duplicate Protection
-- ============================================================
BEGIN;
ALTER TABLE public.riba_responses
ADD COLUMN device_token_hash TEXT;
-- Öğrenci: device token kullanılmaz.
-- Veli/Öğretmen: device token zorunludur.
ALTER TABLE public.riba_responses
ADD CONSTRAINT chk_riba_responses_device_token
CHECK (
    (participant_type = 'student' AND device_token_hash IS NULL)
    OR
    (participant_type IN ('parent', 'teacher') AND device_token_hash IS NOT NULL)
);
-- Aynı uygulamada, aynı katılımcı türü ve aynı anonim
-- tarayıcı/cihaz tokenı ile ikinci gönderimi engeller.
CREATE UNIQUE INDEX uq_riba_responses_device_submission
ON public.riba_responses (
    application_id,
    participant_type,
    device_token_hash
)
WHERE participant_type IN ('parent', 'teacher');
COMMIT;
