# Data Model

Semua primary key UUID kecuali dinyatakan lain. Semua tabel memiliki `created_at`; mutable tables memiliki `updated_at`. Gunakan UTC.

## Identity and tenancy

- `organizations(id, name, slug, timezone)`
- `profiles(id -> auth.users, organization_id, display_name, status)`
- `memberships(id, organization_id, user_id, role, status)`
- `cohorts(id, organization_id, teacher_id, name, academic_year)`
- `cohort_members(cohort_id, student_id, status)`
- `guardian_links(id, guardian_id, student_id, status, consent_at)`

## Content

- `courses(id, organization_id, owner_id, slug, title, description, status)`
- `course_versions(id, course_id, version, published_at)`
- `levels(id, course_version_id, position, title, passing_score, mastery_threshold)`
- `modules(id, level_id, position, title)`
- `lessons(id, module_id, position, title, estimated_minutes, required)`
- `activities(id, lesson_id, position, type, title, content_json, required)`
- `competencies(id, organization_id, code, title)`
- `activity_competencies(activity_id, competency_id, weight)`
- `prerequisites(id, target_type, target_id, required_type, required_id, rule_json)`

## Enrollment and learning

- `enrollments(id, course_id, student_id, cohort_id, status, enrolled_at)`
- `learning_events(id, enrollment_id, student_id, event_type, entity_type, entity_id, occurred_at, client_event_id, metadata_json)`
- unique `(student_id, client_event_id)` for offline/idempotent sync
- `progress_snapshots(id, enrollment_id, entity_type, entity_id, status, percent, mastery, last_activity_at)`
- `study_sessions(id, enrollment_id, started_at, ended_at, active_seconds)`

## Assessment

- `assessments(id, activity_id, settings_json, total_points)`
- `questions(id, organization_id, type, prompt_json, explanation_json, difficulty)`
- `question_versions(id, question_id, version, grading_json, points)`
- `assessment_questions(assessment_id, question_version_id, position, points)`
- `attempts(id, assessment_id, enrollment_id, attempt_no, status, started_at, submitted_at, raw_score, final_score, idempotency_key)`
- `responses(id, attempt_id, question_version_id, answer_json, auto_score, manual_score, feedback_json)`
- `grade_revisions(id, attempt_id, previous_score, new_score, reason, changed_by)`
- `rubrics(id, organization_id, title)` dan `rubric_criteria(...)`

## Certificates and operations

- `certificates(id, public_id, enrollment_id, level_id, serial_no, status, issued_at, revoked_at, payload_json, payload_hash, pdf_path, qr_path, chain_anchor_id)`
- `chain_anchors(id, provider, network, transaction_ref, merkle_root, status, anchored_at)`
- `jobs(id, type, status, payload_json, attempts, last_error)`
- `audit_logs(id, organization_id, actor_id, action, target_type, target_id, before_json, after_json, ip_hash)`

## Constraints penting

- Satu membership aktif per user-organisasi-role.
- Satu active enrollment per student-course/cohort sesuai kebijakan.
- Attempt number unik per enrollment-assessment.
- Certificate aktif unik per enrollment-level-version.
- Nilai 0–100 dan mastery 0–1 melalui CHECK constraint.
- Tidak ada hard delete untuk attempt, revision, certificate, atau audit log.

