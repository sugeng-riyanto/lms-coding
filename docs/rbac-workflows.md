# RBAC Workflows — All Roles

> Setiap role memiliki route terisolasi, capability terbatas, dan data yang
> hanya bisa diakses melalui RLS. Role di-resolve **server-side** dari
> `memberships` table — tidak pernah dari client/user_metadata.

---

## 1. Role Overview

| Role | Dashboard | Purpose |
|---|---|---|
| **Teacher** (`guru`) | `/teacher` | Manage courses, cohorts, grading, questions, certificates |
| **Student** (`murid`) | `/learn` | Learn content, take quizzes, view progress & certificates |
| **Guardian** (`wali`) | `/guardian` | View linked child's summary (read-only) |

A user can hold **multiple roles** across different organizations. The
dashboard hub (`/dashboard`) redirects to the first matching role in
priority order: teacher → guardian → student.

---

## 2. Login Flow

```
┌─────────────┐
│  /login     │  Email + Password
│             │  (or language toggle: EN/ID)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ GoTrue Auth │  POST /auth/v1/token?grant_type=password
│ (Supabase)  │  Returns JWT with access_token
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ /dashboard  │  Server reads memberships table
│  (hub)      │  Redirects based on role:
│             │    teacher  → /teacher
│             │    guardian → /guardian
│             │    student  → /learn
└─────────────┘
```

**Key rules:**
- Role is resolved from `memberships` table (server-controlled), never from client.
- If no active membership exists → redirect back to `/login`.
- If account is inactive → `/account-inactive` shell.

---

## 3. Teacher Workflow

### 3.1 Route Map

```
/teacher                          Dashboard (cohort matrix, risk signals)
/teacher/courses                  Course list
/teacher/courses/new              Create new course
/teacher/courses/[id]             Manage course (levels, publish, version)
/teacher/courses/[id]/levels/[lid]  Level manager (modules, lessons, activities)
/teacher/courses/[id]/preview     Preview as student
/teacher/cohorts                  Cohorts & enrollment (bulk XLSX, manual)
/teacher/questions                Question bank (import, create, rubrics)
/teacher/grading                  Grading queue (essays, manual scores)
/teacher/analytics                Class analytics (item stats, misconceptions)
/teacher/certificates             Certificates & anchoring
/teacher/students/[id]            Student detail (attempts, timeline, certs)
/teacher/admin/map                Admin: class & subject mapping (XLSX bulk)
/teacher/admin/security           Security & monitoring (CSP alerts)
/settings                         Account & language preferences
```

### 3.2 Core Workflows

#### A. Course Creation & Publishing

```
1. /teacher/courses/new
   → Fill title, slug, description
   → Save as DRAFT

2. /teacher/courses/[id]
   → Add levels (Level 1, 2, 3...)
   → Each level has modules → lessons → activities

3. /teacher/courses/[id]/levels/[lid]
   → Create modules with objectives
   → Add lessons to modules
   → Add activities to lessons:
      - article (markdown content)
      - quiz (linked to question bank)
      - code_board (in-browser code runner)
      - embed_web / embed_video (iframe)
      - media (youtube, pdf, image, audio)

4. /teacher/courses/[id]
   → Publish course (validates: all levels have content)
   → Creates new version (immutable previous versions)
```

#### B. Question Bank Management

```
1. /teacher/questions
   → Import pack (MCQ/essay/combined) via text format:
     TYPE | Prompt | Options A-D | Key | Points | Note
   → Or create individual questions:
     - single_choice, multiple_choice, true_false
     - numeric_tolerance, short_text
     - essay_manual, file_manual

2. Attach media to questions (optional):
   - youtube, pdf, web, video, image, audio

3. Publish version + answer key:
   - correct=b  (single choice)
   - corrects=a,c  (multiple choice)
   - expected=3.14, tolAbs=0.01  (numeric)
   - accepted=Soekarno  (short text)
   - (essays graded manually)

4. Rubrics for essay questions:
   - Add rubric title + criteria with max points
   - Versioned per question (old versions immutable)
```

#### C. Grading

```
1. /teacher/grading
   → Queue shows submitted essays/projects
   → Each item shows: student, question, answer, canvas annotations

2. Review student work:
   - Read text answer
   - View canvas drawing (science/math annotations)
   - Check uploaded files

3. Grade:
   - Apply rubric scores per criterion
   - Or manual score + feedback
   - Score changes recorded as revisions + audit (append-only)

4. Release:
   - Immediate release: scores visible to student right away
   - Manual release: teacher must finalize → student sees "pending release"
```

#### D. Cohort & Enrollment Management

```
1. /teacher/cohorts
   → Create cohort (class name + academic year)
   → Bulk register students via XLSX (email + name)
   → Manual enrollment: student UUID + course

2. Manage members:
   - View roster with status (active/suspended)
   - Suspend enrollment (disables access, keeps history)
   - Export roster as CSV
```

#### E. Certificate Issuance

```
1. /teacher/certificates
   → View eligible students (completed all levels + passed final exam)
   → Issue certificate (generates PDF with QR code)
   → Anchor to blockchain (optional, mock provider)
   → Reissue if needed (with reason audit trail)
```

### 3.3 Teacher Capabilities

| Capability | Description |
|---|---|
| `manage_own_courses` | Create, edit, publish, version courses |
| `manage_own_cohort_enrollments` | Enroll/suspend students, manage cohorts |
| `view_own_cohort_progress` | See cohort matrix, risk signals, analytics |
| `manual_grade` | Grade essays, apply rubrics, release scores |
| `verify_certificate` | Verify any certificate via public verifier |

---

## 4. Student Workflow

### 4.1 Route Map

```
/learn                   Dashboard (today's target, level map, progress)
/learn/[id]              Course level map (modules → lessons → activities)
/catalog                 Browse published courses
/activities/[id]         Activity view (article, quiz, code board, embed)
/quiz/[attemptId]        Quiz taker (questions, submit, result)
/review                  Spaced review (flashcards)
/certificates            My certificates
/certificates/[id]       Certificate detail (PDF download)
/settings                Account & language preferences
```

### 4.2 Core Workflows

#### A. Learning Flow

```
1. /catalog
   → Browse published courses
   → Enroll in a course (creates enrollment)

2. /learn
   → See today's target (next activity to complete)
   → View level map for enrolled courses

3. /learn/[id]
   → Level map shows: modules → lessons → activities
   → Activities unlock sequentially (mastery-based)
   → Prerequisites must be completed first

4. /activities/[id]
   → Read article (markdown with embeds)
   → Watch video / listen to audio
   → View embedded web content (PhET, etc.)
   → Run code in browser (Pyodide WASM)
   → Answer questions (auto-saved)
```

#### B. Quiz Flow

```
1. Start quiz from activity page
   → Server creates attempt (in_progress)
   → Questions randomized server-side

2. Answer questions:
   → Each answer auto-saves via saveResponse RPC
   → "Saving..." indicator shows during save
   → Canvas pad available for essay questions

3. Submit:
   → Confirm dialog → submitAttempt RPC
   → "Submitting..." indicator during submit
   → Server finalizes attempt

4. Result (based on release policy):
   → Immediate: shows score + per-question auto scores
   → Manual: "Answers submitted. Score awaits teacher release."
   → Result persists across page reload (server-rendered)
```

#### C. Certificate Download

```
1. /certificates
   → List of earned certificates
   → Each shows: course name, date, status

2. /certificates/[id]
   → View certificate details
   → Download PDF (2 pages: main + completeness info)
   → QR code for verification
```

### 4.3 Student Capabilities

| Capability | Description |
|---|---|
| `learn_on_active_enrollment` | Access course content for active enrollments |
| `submit_own_attempt` | Submit quiz answers (own attempts only) |
| `download_own_certificate` | Download PDF of own certificates |
| `verify_certificate` | Verify any certificate via public verifier |

---

## 5. Guardian (Wali) Workflow

### 5.1 Route Map

```
/guardian                 Dashboard (linked child summary)
/settings                 Account & language preferences
```

### 5.2 Core Workflow

```
1. /guardian
   → See linked child's name and status
   → View enrollment summary (courses, progress %)
   → View quiz scores (read-only)
   → View certificates (read-only)

2. What guardians CANNOT do:
   → Cannot see student answers or detailed submissions
   → Cannot grade or modify any data
   → Cannot access course content
   → Cannot manage enrollments
```

### 5.3 Guardian Capabilities

| Capability | Description |
|---|---|
| `view_linked_child_summary` | Read-only view of linked child's progress |
| `verify_certificate` | Verify any certificate via public verifier |

---

## 6. Public Routes (No Auth Required)

```
/login                    Sign in page
/verify/[publicId]        Certificate verifier (QR code target)
/api/health               Health check endpoint
/api/certificates/[id]    Certificate PDF download
/api/certificates/[id]/record  Machine-readable JSON record
```

---

## 7. Data Isolation Rules

| Rule | Enforcement |
|---|---|
| Students see ONLY own data | RLS: `student_id = auth.uid()` or via enrollment chain |
| Teachers see ONLY own cohort data | RLS: `cohort_id IN (teacher_cohort_ids())` |
| Guardians see ONLY linked child | RLS: `student_id IN (linked_children())` |
| No client role trust | Role resolved from `memberships` table (server) |
| Answer keys never reach browser | Server-side only; quiz-taker gets `savedAnswer` not `correct` |
| Attempts are append-only | `no_delete_attempts` rule; corrections create revisions |
| Certificates are append-only | `no_delete_certs` rule; revocation creates new status |

---

## 8. Language Toggle

All surfaces support bilingual UI (English / Bahasa Indonesia):

```
Settings → Interface Language → English / Bahasa Indonesia
```

- Toggle persists in `localStorage` (device-level)
- Synced to `profiles.preferred_language` on first sign-in
- `<html lang>` attribute tracks the preference
- All UI strings via `lib/ui-text/*.ts` dictionaries
- Lint gate prevents hardcoded Indonesian in shell components

---

## 9. Quick Reference: What Can Each Role Do?

| Action | Teacher | Student | Guardian |
|---|---|---|---|
| Create course | ✅ | ❌ | ❌ |
| Add content (article, quiz, embed) | ✅ | ❌ | ❌ |
| Import questions | ✅ | ❌ | ❌ |
| Grade essays | ✅ | ❌ | ❌ |
| Issue certificates | ✅ | ❌ | ❌ |
| Enroll students | ✅ | ❌ | ❌ |
| View cohort progress | ✅ | ❌ | ❌ |
| View analytics | ✅ | ❌ | ❌ |
| Take quizzes | ❌ | ✅ | ❌ |
| View own progress | ❌ | ✅ | ❌ |
| Download own certificate | ❌ | ✅ | ❌ |
| View linked child summary | ❌ | ❌ | ✅ |
| Verify any certificate | ✅ | ✅ | ✅ |
| Change language | ✅ | ✅ | ✅ |
| Admin mapping (org admin) | ✅* | ❌ | ❌ |
| Security monitoring (org admin) | ✅* | ❌ | ❌ |

*Admin features require `org-admin` facet on the teacher membership.

---

## 10. Architecture Diagram

```
                    ┌──────────────┐
                    │   /login     │
                    │  (GoTrue)    │
                    └──────┬───────┘
                           │ JWT
                           ▼
                    ┌──────────────┐
                    │  /dashboard  │ ← Server resolves role from memberships
                    │    (hub)     │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ /teacher │   │ /learn   │   │ /guardian│
     │  (guru)  │   │ (murid)  │   │  (wali)  │
     └────┬─────┘   └────┬─────┘   └────┬─────┘
          │              │              │
          ▼              ▼              ▼
     ┌──────────────────────────────────────┐
     │           Supabase (Postgres)        │
     │  ┌─────────┐ ┌──────────┐ ┌───────┐ │
     │  │courses  │ │enrollments│ │attempts│ │
     │  │levels   │ │responses  │ │certs  │ │
     │  │lessons  │ │progress   │ │audit  │ │
     │  │activities│ │snapshots │ │       │ │
     │  └─────────┘ └──────────┘ └───────┘ │
     │         RLS enforces data isolation  │
     └──────────────────────────────────────┘
```
