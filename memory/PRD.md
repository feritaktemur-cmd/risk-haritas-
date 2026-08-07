# School Risk Maps — PRD

## Original Problem Statement
Web application for creating and analyzing **School Risk Maps**, used by Guidance and Research Centers (RAM) and schools.

Core requirements (static):
- Secure login for RAM administrators and school users; one account per school.
- Schools enter student risk data via class-based forms.
- School Risk Maps generated automatically from class data.
- RAM admins see ONLY aggregated statistics, never individual student data.
- Analyze risk distributions by education level, school type, district, public/private.
- Annual reporting + historical submissions.
- Supabase for database, authentication, and storage.
- Backend-first architecture for sensitive operations.

Constraint (current phase): Only configure the project and establish the Supabase connection.
NO tables, NO migrations, NO schema changes — a custom schema/migration plan is applied later.

## Architecture
- **Frontend**: React (CRA, react-scripts 5), Tailwind. `@supabase/supabase-js` v2.45.4 (pinned for Node 20). Client at `src/lib/supabaseClient.js` using publishable key.
- **Backend**: FastAPI. `supabase-py` v2.31.0. Two clients in `supabase_client.py`: service client (secret key, bypasses RLS) + anon client (publishable key). All routes under `/api`.
- **Supabase project**: https://jhirusgxqcmrkegrmxwi.supabase.co (new key format: sb_publishable_ / sb_secret_).

## Implemented (2026-06 / 2026-08-07)
- [DONE] Full-stack scaffold created from empty workspace.
- [DONE] Supabase clients wired on backend (secret) + frontend (publishable).
- [DONE] Connection verification endpoints: `GET /api/health`, `GET /api/supabase/status` (checks Auth admin + Storage buckets, no tables needed).
- [DONE] Connection-status dashboard UI (Backend, Frontend, Auth, Storage cards). All verified GREEN/connected.
- Corrected a typo in the provided Project URL (21→20 char ref) that caused DNS failure.

## Backlog (next phases — require the custom schema first)
- P0: RAM admin + school user auth (one account per school) — via Supabase Auth. MUST call integration_expert before implementing auth.
- P0: Class-based student risk data entry forms (school side).
- P1: Automatic School Risk Map generation from class data.
- P1: RAM aggregated analytics (by education level, school type, district, public/private) — enforce no individual data exposure (backend-first + RLS).
- P2: Annual reporting + historical submissions.

## Notes
- supabase-js pinned to 2.45.4; versions >=~2.11x require Node >=22 (env has Node 20).

## Excel Preview System (READ-ONLY, no import) — 2026-08-07
- RAM Admin selects management type (Resmî/Özel) + Excel file, gets a PREVIEW only. NO DB writes.
- Backend: `excel_preview.py` (pure `analyze_rows` + read-only `load_reference`) and `POST /api/schools/preview`.
- Validates rows against `districts` and `school_types` (read-only). Reference tables already exist in Supabase (15 districts, 25 school_types) — migrations 001/002/005 were applied by the user.
- Rules: Turkish-aware normalization (whitespace/case), MEB aliases (Anadolu Meslek Programı→Mesleki ve Teknik Anadolu Lisesi; Özel Eğitim Meslek Okulu (Zihinsel Engelliler)→Özel Eğitim Meslek Okulu), out-of-scope auto-flag (RAM, BİLSEM, İlçe MEM, Halk Eğitimi Merkezi).
- Statuses: YÜKLENEBİLİR / KAPSAM DIŞI / HATALI İLÇE / HATALI OKUL TÜRÜ. Summary counts + table.
- Frontend: `pages/SchoolImportPreview.jsx` (main route "/"), `pages/ConnectionStatus.jsx` ("/status"), router in `App.js`.
- E2E verified via API + UI screenshot. Import/insert NOT built yet (next step, pending approval).

## Secure Import ("Okulları Aktar") — 2026-08-07
- `POST /api/schools/import` (backend-only, service client). Inserts ONLY loadable rows into `schools`.
- Refuses to start if any HATALI İLÇE / HATALI OKUL TÜRÜ (returns 400, no insert).
- Field mapping: name→name, MERNIS→mernis_address_code (TEXT), district→district_id, MEB type→school_type (via alias/normalize)→school_type_id; education_level_id auto from matched school_type; management_type_id from management_types by name; is_active=true.
- Duplicate protection (backend layer, NO new UNIQUE constraint): key = (normalized name, district_id, mernis_address_code). Existing or within-file dup → "ZATEN MEVCUT", skipped. MERNIS alone is NOT a dup criterion (same MERNIS + different school/district both insert).
- Atomic single bulk INSERT (all-or-nothing); on failure → 500 with clear message, nothing written.
- Result summary: Toplam / Eklenen / Zaten Mevcut / Kapsam Dışı / Hatalı / Atlanan; per-row statuses EKLENDİ / ZATEN MEVCUT / KAPSAM DIŞI / HATA.
- Frontend: "{loadable} Okulu Aktar" button (enabled only when preview done & invalid_district=0 & invalid_school_type=0 & loadable>0). Frontend never does direct Supabase inserts; secret key stays backend-only.
- Tested (all pass, test rows cleaned up): same MERNIS×2 both insert; re-upload → all ZATEN MEVCUT; out-of-scope never inserted; bad district → 400 no insert; education_level_id auto-mapped correctly.
- NO users/auth, NO migrations, NO schema/RLS changes, reference tables untouched.
- ✅ ACCEPTED by user 2026-08-07: 114 real schools imported to Supabase successfully in production. Module frozen (no further changes for now).
