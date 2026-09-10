# Autonomous Learning LMS

Production-ready LMS with personal learning paths, teacher dashboards, mastery learning, quizzes, auto-grading, real-time progress, and A4 PDF certificates with QR verification. Bilingual EN/ID with English as default.

## Demo accounts & roles (RBAC)

Seed accounts for local/preview (see `docs/e2e-setup.md` and `RBAC.md`). Hosted passwords are rotated — see notes below.

| Role | Email | Local password | Hosted password | Access |
|---|---|---|---|---|
| Teacher | `guru@demo.local` | `DemoPass-2026!` | `PhysDemo-2026!` | `/teacher` — classes, cohort matrix, grading, question bank, analytics, certificates |
| Student | `murid01@demo.local` | `DemoPass-2026!` | `PhysDemo-2026!` | `/learn` — targets, level map, quizzes; `/catalog`, `/review`, own certificates |
| Student | `murid02@demo.local` | `DemoPass-2026!` | `PhysDemo-2026!` | Same as Murid 01 (data isolated per student) |
| Student | `murid03@demo.local` | `DemoPass-2026!` | `PhysDemo-2026!` | Same as Murid 01 (data isolated per student) |
| Guardian | `wali@demo.local` | `DemoPass-2026!` | `PhysDemo-2026!` | `/guardian` — child progress, quiz scores, study time, certificates |
| Public | — (no login) | — | — | `/verify/{public_id}` — minimal-PII certificate verification |

> ⚠️ Demo accounts are for local/preview only. Hosted passwords were rotated on 2026-09-08. Rotate again before real student data enters. Guardians see only linked children via active guardian links; public sees no internal data.

> 📖 **Full workflow per role**: see [`docs/rbac-workflows.md`](docs/rbac-workflows.md) for detailed teacher, student, and guardian flows.

## Goals

- Students have a personal learning path and can study independently.
- Teachers monitor engagement, mastery, at-risk students, and grades.
- Content, quizzes, projects, remedial, and certificates are manageable without code changes.
- Student data is secure: least privilege, RLS, audit logs, data minimization, and consent per school policy.

## Tech stack

- Next.js App Router + TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase Auth, Postgres, Storage, Realtime, Edge Functions
- Zod validation
- React Hook Form
- Vitest + Testing Library + Playwright
- PDFKit for certificates
- QR code → `/verify/{public_id}`
- SHA-256 hash; optional blockchain anchoring via adapter
- In-browser code runner (Pyodide WASM) for Python
- CSP nonce + frame-src allowlist + security monitor

## Quick start

1. Copy this folder to an empty repository root.
2. Open a terminal in the folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and fill in Supabase credentials.
5. Run `npm run dev` and open `http://localhost:3000`.

## Source of truth order

1. `AGENTS.md`
2. `PRODUCT_REQUIREMENTS.md`
3. `RBAC.md` and `SECURITY_PRIVACY.md`
4. `DATA_MODEL.md`
5. `LEARNING_ENGINE.md`
6. Other feature documents
7. `IMPLEMENTATION_PLAN.md`
8. `ACCEPTANCE_CRITERIA.md`

If conflicts arise, the higher-ordered document wins. Never guess scoring rules or data policies; create configuration and flag decisions requiring teacher input.

## Key documentation

- `RBAC.md` / `SECURITY_PRIVACY.md` — roles, RLS, and data policies (must read before writing access code).
- `docs/design-system.md` — elevation tokens, `.card-lift`, gradient rules, dark mode palette, reduced-motion policy. **Read before styling new components** for consistency.
- `docs/compound-unit-authoring.md` — teacher guide for numeric questions with compound units (km/jam, kg·m/s², m/s²): syntax, `unitFactors`, exponents/superscripts, validation, and question pack templates.
- `docs/runbooks.md` — operational procedures (migration, seed, live-denial, backup/restore).
- `docs/release-checklist.md` — release checklist and smoke tests.
- `docs/pilot-deployment.md` — pilot deployment playbook: env set, db push + smoke sequence, restore procedure (rehearsal 9/9).
- `docs/production-readiness-checklist.md` — full production readiness checklist: domain, HTTPS, env vars, demo cleanup, monitoring, security, rollback.
- `docs/language-policy.md` — UI language policy: public shells MUST be English, role dashboards bilingual. **Read before adding text to shell pages** (enforced by `lms/no-indonesian-shell-text`).
- `PROGRESS.md` — phase status, gate evidence, and remaining work.

## MVP is complete when

- Teachers can create course → level → lesson → activity → assessment.
- Students can learn, resume position, take quizzes, and receive feedback.
 - Objective scores are auto-calculated and attempt history is preserved.
- Teacher dashboard shows progress, mastery, study time, and at-risk students.
- Levels lock/unlock based on prerequisite and mastery threshold.
- Certificates are auto-issued, QR-verifiable, and revocable.
- Guardian dashboard shows child progress, quiz scores, study time, and certificates.
- Compound-unit grading works for physics (km/jam, kg·m/s²) and chemistry (mol/L, g/mol).
- RLS serta denial tests lulus.
- Unit, integration, dan end-to-end tests utama lulus.
# lms-coding

