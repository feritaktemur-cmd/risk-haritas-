-- ============================================================
-- Migration 026: RİBA Access Links
-- ============================================================
BEGIN;
CREATE TABLE public.riba_access_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL
        REFERENCES public.riba_applications(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    participant_type TEXT NOT NULL
        CHECK (participant_type IN ('student', 'parent', 'teacher')),
    token_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_riba_access_links_application_participant
        UNIQUE (application_id, participant_type),
    CONSTRAINT uq_riba_access_links_token_hash
        UNIQUE (token_hash)
);
CREATE INDEX idx_riba_access_links_application
    ON public.riba_access_links (application_id);
CREATE INDEX idx_riba_access_links_token_hash
    ON public.riba_access_links (token_hash);
-- Backend-first güvenlik.
ALTER TABLE public.riba_access_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.riba_access_links
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.riba_access_links
TO service_role;
COMMIT;
