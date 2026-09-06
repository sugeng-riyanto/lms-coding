# Implementation Plan

## Phase 0 — Foundation

- Scaffold Next.js TypeScript, lint, formatter, test runners.
- Configure local Supabase and environment validation.
- Add CI: lint, typecheck, tests, build.
- Create public shell, auth shell, teacher/student navigation.

Exit: clean install, local start, CI green, no secrets committed.

## Phase 1 — Identity, tenancy, RBAC

- Schema organization/profile/membership/cohort.
- Auth SSR pattern according to current official docs.
- RLS policies and denial tests.
- Teacher and student route guards.

Exit: seeded users see only authorized data.

## Phase 2 — Course authoring and enrollment

- Versioned course hierarchy and publish workflow.
- Cohort/enrollment management.
- Student catalog and level map.

Exit: teacher publishes course; enrolled student can access; outsider denied.

## Phase 3 — Learning player and progress

- Lesson player, learning events, autosave, progress projection.
- Resume, prerequisites, next-best-action, offline retry queue.

Exit: refresh/device interruption does not lose progress; unlock server-authoritative.

## Phase 4 — Assessment

- Question bank, quiz builder, attempts, objective grading, manual grading, rubrics.
- Score revision and competency evidence.

Exit: all supported question types and attempt lifecycle pass tests.

## Phase 5 — Teacher analytics

- Overview, cohort matrix, student detail, alerts, CSV export.
- Realtime where useful with polling fallback.

Exit: metrics reconcile with raw attempts/events for fixture dataset.

## Phase 6 — Certificates

- Eligibility evaluator, deterministic payload hash, PDF A4, QR verifier, download.
- Revocation/reissue and audit.
- Blockchain adapter stub + feature flag; optional provider only after decision record.

Exit: tampered payload fails verification; revoked certificate clearly invalid.

## Phase 7 — Hardening and deployment

- Accessibility, performance, responsive QA, rate limits, backup/restore rehearsal.
- Security/advisor checks, dependency audit, observability, runbooks.

Exit: `ACCEPTANCE_CRITERIA.md` fully evidenced.

