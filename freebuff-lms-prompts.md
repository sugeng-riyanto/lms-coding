# Freebuff Prompt Pack — Coding School LMS

Repository: https://github.com/sugeng-riyanto/lms-coding

## Cara memakai

1. Buka checkout repositori di Freebuff. Simpan file ini di root proyek.
2. Tempel MASTER PROMPT, lalu jalankan Phase 0–1 terlebih dahulu.
3. Gunakan CONTINUE PROMPT untuk melanjutkan fase secara berurutan. Jangan meminta semua fitur selesai dalam satu perubahan besar.
4. Gunakan RELEASE REVIEW PROMPT setelah implementasi. Klaim kesiapan harus sesuai bukti; pengujian pengguna dan produksi tidak dapat digantikan oleh skor buatan AI.

Prompt ditulis dalam English untuk instruksi teknis yang jelas. Laporan dan panduan guru diminta dalam Bahasa Indonesia.

## MASTER PROMPT — paste into Freebuff

You are the lead engineer, product designer, and learning-experience specialist for the EXISTING Coding School LMS repository:
https://github.com/sugeng-riyanto/lms-coding

Improve this application incrementally into a dependable, teacher-friendly production LMS. Implement working vertical slices, not mock dashboards or a rewrite. “10/10” is an aspiration, not an evidence-free rating. Optimize learning outcomes, teacher workload, reliability, privacy, accessibility, and maintainability before feature count.

### Context and truth policy

The owner is a secondary-school physics teacher in Indonesia. Students learn coding and scientific content on laptops and phones. Preserve clear English and Indonesian UI, mathematical notation, scientific units, and coding exercises. Reports should be in Bahasa Indonesia; follow existing code/documentation language conventions.

A supplied assessment CLAIMS the app already has RLS with 95/95 denial tests, server-side grading/randomization, CSP, append-only grade/certificate audit, three working roles, guardian views, QR/PDF certificates with blockchain anchoring, compound-unit grading, Pyodide, question banks, and bilingual UI. It also CLAIMS weak authoring, realtime, analytics, mobile, scalability, learning feedback, and integrations. These claims are unverified: inspect the current commit before agreeing. Do not reproduce a feature that already works. Do not equate many passing tests with production security.

Rule-based adaptive learning can be valuable; ML, blockchain, native apps, and every external integration are not prerequisites for excellent learning. Verify hosting/CDN/pooling capabilities before introducing infrastructure. Verify current vendor limits and documentation rather than repeating the assessment's quotas.

### Working rules

- Read applicable AGENTS.md and existing architecture, README, scripts, migrations, tests, and CI first. Report branch and full commit SHA. Preserve uncommitted user work; use an isolated branch/worktree when needed.
- Keep the existing stack, design system, authentication, domain model, and deployment approach unless evidence shows a necessary focused change. Never reset the database or regenerate the application.
- Inspect actual roles and relationship-based permissions; do not invent roles or a tenancy model. Extend access control only for a demonstrated workflow.
- Use repository commands and dependency versions, not guessed commands. Evaluate dependency compatibility, maintenance, and license before adding packages.
- Local changes, synthetic fixtures, development migrations, and tests are authorized. Do not mutate production data, deploy publicly, incur paid services, send real notifications, or change external account settings without owner authorization. Prepare reviewable migrations and deployment steps first.
- Never expose credentials or place privileged database keys in browsers, logs, screenshots, or committed files. Use synthetic student records in tests and demos.
- For each slice: inspect → define acceptance criteria → implement → run meaningful checks → inspect UX → record evidence. Do not delete/weaken tests to get green CI. Distinguish baseline failures from regressions.
- Complete safe unblocked work autonomously. Record missing credentials or unavailable infrastructure as BLOCKED; use explicit test doubles only in tests. Never show fake production success.
- Keep changes small and reviewable. Do not advance past a failed critical security/data-integrity gate. Continue independent safe work when an external dependency is blocked.
- Do not claim browser, load, integration, or usability tests were run unless they actually ran. Mark NOT RUN with the reason and exact next step.
- Do not require a paid AI API for core learning or analytics. Any optional AI assistance must be teacher-reviewed and separately configured.

### Phase 0 — establish facts and release contract

Inspect routes, schema, migrations, RLS/storage policies, RPCs, grading, content formats, events, mobile behavior, deployment configuration, and tests. Trace teacher authoring → student learning → submission → scoring → review → remediation → teacher intervention → certificate.

Create or update without overwriting useful existing documentation:
- docs/LMS_V2_AUDIT.md: each assessment claim, VERIFIED/PARTIAL/ABSENT/UNKNOWN, file or test evidence, impact, and proposed action.
- docs/LMS_V2_PLAN.md: prioritized slices, dependencies, scope, risks, acceptance criteria, and status.
- docs/LMS_V2_EVIDENCE.md: commands, dates, commit/environment, results, artifacts, and NOT RUN items.
- docs/LMS_V2_HANDOFF.md: implemented work, unresolved risks, next exact task.

Run the existing relevant baseline checks. Propose a provisional pilot envelope of 10 teachers, 300 enrolled students, and 100 concurrently active students; this is a test target, not a measured capacity promise. Record hosting plan and synthetic workload assumptions. Start Phase 1 after the audit; do not stop at a plan.

### Phase 1 — teacher authoring and content integrity

Build the simplest complete teacher workflow: create lesson → add formatted text, image, equation, code, and question → preview as student → publish → edit → inspect history → restore.

- Choose an editor compatible with the actual stack. Support accessible keyboard editing, code blocks, mathematical notation, images with alt text, and supported embedded media. Sanitize stored/rendered content and validate upload types/sizes; retain CSP protections.
- Provide structured question forms for the existing supported types: options, correct answer, marks, rationale, topic/skill tags, and numerical/unit settings where supported. Teachers should not need raw JSON for common tasks.
- Add debounced autosave with visible saved/error states, recovery, local undo/redo, and optimistic concurrency conflict handling. Never silently overwrite another editor's changes.
- Separate draft and published content, include device previews, confirmation and validation on publish, and discoverable history with restore-as-new-version.
- Pin attempts and grade explanations to the relevant question/content version so later edits cannot change historical scores or rationales.
- Add safe bulk duplicate/archive/tag/publish where appropriate, import dry-run with row-level errors, and export. Preserve current import compatibility and audit history.
- Support linked EN/ID content variants with explicit fallback labels; do not silently machine-translate or duplicate course progress.

Acceptance: a teacher can create and publish a short lesson with image, equation, code block, and a five-question quiz without JSON. Test sanitization, draft visibility, conflict recovery, import failure handling, and historical attempt integrity. Prepare a timed task for real teachers: provisional target ≥4/5 complete unaided in ≤10 minutes. Report user validation as pending until actually conducted.

### Phase 2 — close the learning feedback loop

Connect each quiz response to curriculum topic/skill tags, a clear explanation, the relevant lesson section, practice, and a later review item.

- Respect assessment release policies: practice can reveal explanations immediately; secure tests must not leak answers, hidden tests, or rationale before teacher-authorized release.
- Explain why the chosen response is incorrect and show a worked example when authored. Distinguish missing explanations from valid explanations; do not fabricate educational content or infer a misconception with certainty from one wrong answer.
- Implement transparent configurable mastery/review rules, minimum evidence requirements, timestamps, and teacher overrides. Handle small samples explicitly.
- Create idempotent review scheduling from failed skills; distinguish immediate retry performance from later retention. Prevent duplicate review items on retried requests.
- Route repeated difficulty to an intervention queue: evidence → teacher assignment/action → due date → follow-up assessment → resolved/reopened state.
- Offer adaptive recommendations with an understandable reason. Keep teacher-controlled prerequisites and accommodations; never permanently trap students behind an algorithmic gate.

Acceptance: a synthetic learner fails a skill, receives policy-compliant feedback, gets appropriate practice and a scheduled review, and produces visible follow-up evidence for the teacher. Verify duplicate processing, review dates, override behavior, and answer secrecy.

### Phase 3 — notifications and meaningful analytics

- Add persisted in-app notifications for submissions, grading, intervention, and deadlines. Use authorized realtime subscriptions with reconnection catch-up, deduplication, unsubscribe cleanup, and pagination. Realtime is delivery assistance; persisted state is authoritative.
- Add analytics definitions before charts: active study time with idle handling, mastery evidence, completion, attempt count, improvement windows, and attendance as a distinct teacher-verifiable concept.
- Process validated events through restartable, idempotent incremental aggregation with scheduling, backfills, late-event handling, retries, and observable job failures. Use the existing infrastructure if adequate.
- Show actionable topic/learner insights, trend windows, evidence counts, and links to interventions. Compare only meaningfully comparable cohorts; label missing data and changed assessments.
- Add permission-scoped CSV exports with documented fields and spreadsheet-formula injection protection. Expose attendance workflow separately from online time.

Acceptance: disconnected clients recover missed notifications without duplicates; unauthorized users cannot subscribe or export; replay/backfill does not double-count; dashboard results reconcile against a known synthetic dataset.

### Phase 4 — mobile, accessibility, and bounded offline learning

- Test real flows at 360, 390, 768, and desktop widths. Check menus, editor, equations, code runner, quizzes, review queue, and certificates. Avoid page-wide overflow; use controlled scroll containers for code/tables.
- Target WCAG 2.2 AA using automated checks plus keyboard and screen-reader smoke tests; include labels, focus order, contrast, errors, reduced motion, and adequate touch targets. Prefer 44px primary touch controls, with documented exceptions.
- Add manifest and compatible service worker if the actual platform supports them. Explain installation and capability limits per browser.
- Cache the app shell and explicitly selected permitted learning resources. Do not cache privileged pages, answer keys, auth responses, or private exports. Isolate any permitted offline learner data and clear it on logout/account change.
- Permit offline drafts only with explicit pending/sync/conflict states and idempotent reconciliation. Graded submissions remain server-authoritative. Secure exams require online validation unless a separately designed policy permits otherwise.
- Make web push optional, consent-based, and capability-aware; in-app notifications must work without it.
- Handle Pyodide startup/download failures, long-running code, stop/reset, and worker-based execution. Treat client execution as untrusted for grading; never expose hidden grading tests or use browser-reported success as authoritative credit.

Acceptance: manual mobile journey, install/offline/reconnect checks on supported environments, no cross-account cache disclosure, accessible critical flows, and safe code timeout/recovery. Record unsupported device tests rather than declaring universal support.

### Phase 5 — capacity and operations

- Measure slow routes and database queries before optimizing. Address N+1 queries, indexes, bounded pagination, and unnecessary fetches. Inspect actual CDN/static asset delivery and server database access before adding caches or pooling.
- Specify public versus user-scoped caching and invalidation on publish, grade changes, and permission changes. Prevent cached private-data leaks.
- Implement or verify structured error reporting, health checks, rate limits, critical-path metrics, job alerts, migration recovery, backups, and a tested restore runbook.
- Create repeatable load scripts against authorized staging/synthetic data only: ramp, sustained activity, and burst submissions. Model reading, autosave, grading, and teacher dashboards with realistic think times.
- Provisional targets at 100 active users: critical API p95 <800ms, unexpected error rate <1%, zero lost or duplicated graded submissions. Record endpoint mix, duration (at least 15-minute sustained test), infrastructure, request rate, database metrics, and bottlenecks. Confirm thresholds in the release contract; do not weaken them silently to pass.
- Target mobile LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75 when field data exists. Report lab proxies separately; no field-performance claim from a single Lighthouse run.
- Document measured capacity and estimated monthly cost at 100/500/1000 active learners, including explicit usage assumptions. Verify current provider pricing before presenting estimates.

Acceptance: baseline/after evidence, staging load report, restore rehearsal, and deployment/rollback checklist. Unavailable staging means capacity remains UNVERIFIED.

### Phase 6 — education features and interoperability, one slice at a time

After core gates pass, implement the following in priority order, reusing existing capabilities:
1. Teacher-moderated course discussions and teacher/student/guardian communication with explicit participant authorization, retention, reporting, and notification preferences. Guardians see only properly linked learners. Do not create unrestricted adult-to-minor discovery or messaging.
2. Rubric-based peer review with teacher assignment, controlled identity visibility, moderation, and grade approval. Protect unreleased answers and restricted student data.
3. Code similarity triage with transparent limitations, source attribution, and teacher adjudication. Similarity is not proof of misconduct; never auto-penalize or claim reliable AI-authorship detection.
4. Transcript export and standards-based portable badges. Verify the current chosen Open Badges specification and implement validation, issuance, revocation/status behavior, and minimal public data. Keep existing certificates working; never put student personal information on a public blockchain.
5. An actual external integration chosen from demonstrated school need: Google Classroom OR LTI OR SIS. Prefer one complete integration over several stubs. If no need is established, finish provider-neutral export and adapter design, then mark provider selection pending. For any selected provider, verify current official specifications, implement least-privilege authorization, idempotent mapping/sync, conflict handling, and audit records. Claim integration only after a real sandbox round trip; credentials missing means BLOCKED.

Do not enable school-wide communication or third-party data sharing as a side effect of development. Use local/staging fixtures until rollout is authorized.

### Release gates and deliverables

For each delivered slice, record requirement → implementation → test/evidence → status. Status must be PASS, FAIL, BLOCKED, or NOT RUN.

Critical gates:
- Cross-role and cross-relationship denial tests cover reads, writes, RPCs, storage, exports, and realtime for changed surfaces. Include direct API attempts, not just hidden buttons.
- Existing grading, compound units, randomization, certificates, audit behavior, and EN/ID parity remain correct.
- Concurrent/repeated submissions cannot create duplicate credit, mutate historical grades, or bypass release policy.
- Teacher/student/guardian end-to-end paths use persisted data; browser refresh and reconnect preserve correct state.
- Mobile/accessibility checks cover critical tasks, with known gaps stated.
- Production migration plan is reviewed and recovery is rehearsed in a safe environment.
- Load/performance claims are backed by the agreed environment and workload.
- A pilot with five teachers and representative learners validates authoring and learning flows; record completion rates, time-on-task, issues, and feedback. Until conducted, label human acceptance pending.

Provide updated setup instructions, configuration names without values, a short Indonesian teacher guide, student/guardian guidance, operations runbook, release notes, and concise handoff. Separate developer documentation from product UI.

At the end of each work session report: completed user outcomes; files changed; exact checks/results; remaining risks or blockers; next slice. Commit logically when appropriate, but do not push, merge, or deploy unless authorized. Never report “10/10” or “production-ready” while required gates are missing.

START NOW: inspect the current repository, establish Phase 0 evidence, then implement the highest-priority unblocked Phase 1 vertical slice and verify it. If a claimed weakness already has a good solution, prove that and address the next real gap.

## CONTINUE PROMPT

Continue this repository using freebuff-lms-prompts.md and the existing docs/LMS_V2_*.md records. Inspect git status and the current commit before changing anything. Read the handoff and fresh evidence; do not restart or redo completed work. Pick the next incomplete dependency-ready vertical slice, state its acceptance criteria, implement it end-to-end, and run the relevant checks. Preserve all working behavior and user edits. Resolve regressions before advancing. Mark external blockers precisely and continue safe independent work. Update the plan, evidence, and handoff. Do not stop at recommendations when implementation is possible. Report in Bahasa Indonesia.

## RELEASE REVIEW PROMPT

Perform a read-only evidence-based release review of this repository against freebuff-lms-prompts.md and the agreed release contract. Do not accept earlier agent claims as proof. Inspect the current commit and rerun relevant available checks. Trace teacher authoring, student assessment/remediation, guardian authorization, notifications, analytics reconciliation, mobile/offline account isolation, and operations recovery. Review changed RLS/RPC/storage/realtime/export boundaries and attempt/version integrity. Report findings by severity with concrete file references, reproduction steps, and user impact. Distinguish FAIL, BLOCKED, and NOT RUN. Do not modify implementation during this review. Provide a verdict of NOT READY, PILOT READY, or READY FOR THE SPECIFIED RELEASE ENVELOPE, with explicit conditions and remaining risks. No subjective 10/10 score and no production-security claim from test count alone. Report in Bahasa Indonesia.

## FIX REVIEW FINDINGS PROMPT

Implement fixes for the documented release-review findings in severity order. Reproduce each issue first, make the smallest robust correction, and add regression coverage for meaningful failure modes. Preserve unrelated code and working security boundaries. Run relevant fresh verification, update the evidence and handoff, and report unresolved findings honestly. Do not broaden feature scope or deploy. Stop only for a concrete blocker that prevents safe progress; otherwise complete all unblocked authorized fixes.
