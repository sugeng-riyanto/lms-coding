# LMS V2 Plan — Prioritized Slices

**Last updated**: 2026-09-09  
**Current phase**: Phase 0 complete → Phase 1 complete → Phase 2 partial

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Establish facts and release contract | ✅ COMPLETE |
| Phase 1 | Teacher authoring and content integrity | ✅ COMPLETE |
| Phase 2 | Close the learning feedback loop | ✅ COMPLETE |
| Phase 3 | Notifications and meaningful analytics | 🔄 PARTIAL |
| Phase 4 | Mobile, accessibility, and bounded offline | 🔄 PARTIAL |
| Phase 5 | Capacity and operations | ❌ NOT STARTED |
| Phase 6 | Education features and interoperability | ❌ NOT STARTED |

## Completed Slices

### Phase 0 — Audit ✅

| Slice | Status | Evidence |
|-------|--------|----------|
| Inspect routes, schema, migrations | ✅ DONE | 43 migrations, 33 routes verified |
| Verify RLS policies | ✅ DONE | 95/95 denial tests passing |
| Verify server-side grading | ✅ DONE | `lib/grading.ts`, `features/actions.ts` |
| Create audit document | ✅ DONE | `docs/LMS_V2_AUDIT.md` |

### Phase 1 — Teacher Authoring ✅

| Slice | Status | Evidence |
|-------|--------|----------|
| WYSIWYG content editor | ✅ DONE | `components/markdown-editor.tsx` — Tiptap-based |
| Preview mode | ✅ DONE | Three tabs: Editor, Markdown, Preview |
| Question bank with import | ✅ DONE | `app/(teacher)/teacher/questions/question-bank.tsx` |
| AI prompt builder | ✅ DONE | Auto-fill from lesson title, localStorage persistence |
| Compound-unit authoring docs | ✅ DONE | `docs/compound-unit-authoring.md` — 12 subjects |

### Phase 2 — Learning Feedback ✅

| Slice | Status | Evidence |
|-------|--------|----------|
| Spaced repetition (SM-2) | ✅ DONE | `lib/spaced-repetition.ts`, `components/review-queue.tsx` |
| Migration for spaced_repetition | ✅ DONE | `20260909100000_spaced_repetition.sql` |
| Review queue with mastery | ✅ DONE | Stats dashboard, quality rating, interval tracking |
| Quiz feedback system | ✅ DONE | `lib/quiz-feedback.ts` — explanation and worked examples |
| Grade correction audit | ✅ DONE | Migration `20260909055534` — append-only revisions |

### Phase 3 — Notifications (Partial) 🔄

| Slice | Status | Evidence |
|-------|--------|----------|
| Real-time notification bell | ✅ DONE | `components/notification-bell.tsx` — Supabase Realtime |
| Teacher-student messaging | ✅ DONE | `components/messaging-panel.tsx` — inbox, sent, compose |
| Messages migration | ✅ DONE | `20260909090000_messages.sql` |
| Notification i18n | ✅ DONE | `lib/ui-text/notifications.ts` — EN/ID |
| Actionable analytics | ❌ NOT DONE | Basic charts exist, insights missing |
| CSV export | ❌ NOT DONE | Not implemented |
| Intervention queue | ❌ NOT DONE | Not implemented |

### Phase 4 — Mobile/Accessibility (Partial) 🔄

| Slice | Status | Evidence |
|-------|--------|----------|
| Responsive layout | ✅ DONE | Tailwind breakpoints, mobile drawer |
| PWA manifest | ✅ DONE | `public/manifest.json` |
| Service worker | ✅ DONE | `public/sw.js` — offline caching |
| WCAG 2.2 AA audit | ❌ NOT DONE | Not conducted |
| Keyboard navigation | ❌ NOT DONE | Not verified |
| Screen reader testing | ❌ NOT DONE | Not conducted |
| Touch target verification | ❌ NOT DONE | Not verified |

## Pending Slices (Priority Order)

### High Priority

| # | Slice | Phase | Dependencies | Effort |
|---|-------|-------|--------------|--------|
| 1 | Analytics actionable insights | 3 | None | Medium |
| 2 | CSV export with injection protection | 3 | None | Small |
| 3 | Intervention queue workflow | 3 | Analytics | Medium |
| 4 | WCAG 2.2 AA audit | 4 | None | Medium |
| 5 | Keyboard navigation verification | 4 | None | Small |
| 6 | Performance baseline (load testing) | 5 | None | Large |

### Medium Priority

| # | Slice | Phase | Dependencies | Effort |
|---|-------|-------|--------------|--------|
| 7 | N+1 query detection | 5 | Performance baseline | Medium |
| 8 | CDN configuration | 5 | Hosting setup | Small |
| 9 | Database connection pooling | 5 | Performance baseline | Small |
| 10 | Google Classroom integration | 6 | None | Large |
| 11 | LTI support | 6 | None | Large |
| 12 | Open Badges export | 6 | None | Medium |

### Low Priority

| # | Slice | Phase | Dependencies | Effort |
|---|-------|-------|--------------|--------|
| 13 | Native mobile app | 6 | PWA proven | Very Large |
| 14 | Advanced ML analytics | 6 | Analytics baseline | Large |
| 15 | Peer review system | 6 | Rubric editor | Large |

## Acceptance Criteria by Phase

### Phase 3 — Notifications & Analytics
- [ ] Disconnected clients recover missed notifications without duplicates
- [ ] Unauthorized users cannot subscribe or export
- [ ] Replay/backfill does not double-count
- [ ] Dashboard results reconcile against synthetic dataset
- [ ] CSV export has injection protection

### Phase 4 — Mobile & Accessibility
- [ ] Manual mobile journey at 360px, 390px, 768px
- [ ] WCAG 2.2 AA automated checks pass
- [ ] Keyboard navigation works for critical flows
- [ ] Screen reader smoke tests pass
- [ ] Touch targets ≥44px for primary controls
- [ ] Offline mode works with proper isolation

### Phase 5 — Capacity & Operations
- [ ] Load test: 100 concurrent users, p95 <800ms
- [ ] Error rate <1%
- [ ] Zero lost/duplicated graded submissions
- [ ] Restore rehearsal completed
- [ ] Deployment/rollback checklist documented

### Phase 6 — Education Features
- [ ] Teacher-moderated discussions
- [ ] Rubric-based peer review
- [ ] Code similarity triage
- [ ] Transcript export
- [ ] One external integration (Google Classroom OR LTI)

## Risks & Blockers

| Risk | Impact | Mitigation |
|------|--------|------------|
| No load testing infrastructure | Cannot verify capacity | Use Supabase dashboard metrics |
| No staging environment | Cannot test migrations safely | Use local + hosted preview |
| No real teacher validation | Cannot confirm usability | Mark as "pending user validation" |
| Pyodide WASM size | Slow initial load | Implement progressive loading |
| Supabase free tier limits | May bottleneck at scale | Document limits, plan upgrade path |

## Next Actions

1. **Immediate**: Complete Phase 3 analytics enhancement
2. **This week**: WCAG 2.2 AA audit and keyboard testing
3. **Next week**: Performance baseline with load testing
4. **Future**: Evaluate Google Classroom vs LTI for Phase 6

---

**Plan maintained by**: Buffy (Codebuff agent)  
**Review cycle**: After each phase completion
