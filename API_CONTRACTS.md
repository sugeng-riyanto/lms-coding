# API Contracts

Gunakan Server Actions untuk mutasi UI sederhana dan Route Handlers untuk verifier, exports, webhook, serta integrasi. Semua request divalidasi Zod dan semua response memiliki request ID.

## Core commands

- `createCourse`, `createCourseVersion`, `publishCourseVersion`
- `enrollStudent`, `suspendEnrollment`
- `startActivity`, `recordLearningEvent`, `saveDraft`
- `startAttempt`, `saveResponse`, `submitAttempt`
- `gradeResponse`, `finalizeAttempt`, `releaseGrade`
- `recomputeProgress`, `evaluateLevelCompletion`
- `issueCertificate`, `revokeCertificate`

## Public routes

- `GET /api/public/certificates/{publicId}` → minimal verification result
- `GET /verify/{publicId}` → accessible HTML verification page

## Roblox signed event, fase lanjutan

`POST /api/integrations/roblox/completions`

Payload: `event_id`, `place_id`, `roblox_user_id`, `challenge_id`, `score`, `issued_at`, `nonce`. Signature diverifikasi server. Terapkan timestamp window, nonce uniqueness, rate limit, mapping Roblox account dengan consent, dan append-only receipt.

## Error shape

```json
{
  "error": {
    "code": "ASSESSMENT_ALREADY_SUBMITTED",
    "message": "Jawaban sudah dikirim.",
    "requestId": "uuid"
  }
}
```

Jangan mengirim stack trace, SQL error, policy detail, atau secret ke client.

