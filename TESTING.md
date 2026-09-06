# Testing Strategy

## Unit

- score calculation and tolerance;
- mastery aggregation;
- prerequisite/unlock;
- canonical certificate serialization/hash;
- risk rule explanations;
- CSV escaping.

## Integration

- RLS allow and denial matrix using distinct authenticated users;
- assessment submit idempotency;
- transaction rollback on partial grading failure;
- progress recomputation;
- certificate issue/revoke/reissue;
- private Storage access;
- public verifier data minimization.

## E2E

1. Guru login → create/publish course → enroll student.
2. Murid login → complete lesson → submit quiz → see feedback/progress.
3. Guru grade essay → release grade.
4. Murid completes level → certificate generated → QR verifies.
5. Guru revokes certificate → verifier changes to revoked.
6. Murid A attempts URL/API belonging to Murid B → denied.

## Quality gates

- Lint and typecheck pass.
- Unit/integration/E2E critical path pass.
- Production build pass.
- No high/critical dependency vulnerability without documented mitigation.
- Database advisors reviewed.
- Accessibility scan plus keyboard manual smoke test.
- No secret/answer key/student email in client bundle or logs.

