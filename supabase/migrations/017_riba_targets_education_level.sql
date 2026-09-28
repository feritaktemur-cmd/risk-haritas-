-- Migration 017: RİBA Targets Education Level Scope

BEGIN;

ALTER TABLE public.riba_targets
ADD COLUMN education_level_id SMALLINT NOT NULL
REFERENCES public.education_levels(id)
ON UPDATE CASCADE
ON DELETE RESTRICT;

ALTER TABLE public.riba_targets
DROP CONSTRAINT riba_targets_meb_code_key;

ALTER TABLE public.riba_targets
ADD CONSTRAINT uq_riba_targets_level_meb_code
UNIQUE (education_level_id, meb_code);

CREATE INDEX idx_riba_targets_education_level_id
ON public.riba_targets (education_level_id);

COMMIT;
