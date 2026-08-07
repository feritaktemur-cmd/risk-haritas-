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
