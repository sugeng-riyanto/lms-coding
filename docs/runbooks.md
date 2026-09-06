# Runbooks Operasional

## 1. Compromised teacher account
1. Suspend `memberships.status='suspended'` + `profiles.status='suspended'`.
2. Revoke session via Supabase Auth admin (`auth.admin.signOut(userId)`).
3. Wajibkan reset password + MFA ulang.
4. Audit `audit_logs` 30 hari untuk actor tersebut; rollback grade/certificate via revision/reissue (append-only, jangan hard delete).
5. Catat di DECISIONS.md + PROGRESS.md.

## 2. Accidental grade change
1. Jangan edit langsung — buat `grade_revisions` baru via `grade_response_manual` RPC.
2. Verifikasi `attempts.final_score` hasil recompute; cocokkan dengan fixture CSV export.
3. Beri tahu murid sesuai release policy.

## 3. Failed certificate generation
1. Cek `jobs` type=certificate status=failed + last_error (tersanitasi).
2. Retry idempotent: panggil `issue_certificate` dengan idempotency key SAMA.
3. Verifikasi hash: recompute SHA-256 canonical payload, bandingkan `payload_hash`.
4. Jika PDF hilang, render ulang dari payload yang sama (jangan buat serial baru).

## 4. Stuck job queue
1. List `jobs where status in ('queued','running') order by created_at`.
2. Requeue dengan attempts+1; alert jika attempts > 5.
3. Recompute progress aman dijalankan ulang (projection derived dari events/attempts).

## 5. Database restore
1. Ambil backup point terbaru (point-in-time). Restore ke project ISOLATED dulu.
2. Jalankan `tests/integration/rls.test.ts` + `npm run db:typecheck` di hasil restore.
3. Swap setelah smoke test: login, submit, dashboard, PDF, verifier.

## 6. Revoke exposed secret
1. Rotate di Supabase dashboard + env server (jangan commit).
2. Revoke signed URL lama; PDF di private bucket aman (butuh permission check baru).
3. Grep repo + bundle: pastikan tidak ada `sb_secret`/answer key di client.

## 7. Privacy / data correction request
1. Verifikasi identitas pemohon (wali hanya via guardian link aktif).
2. Koreksi via UPDATE dengan audit log before/after (redact token/email/nilai dari log teks).
3. Retention: hapus hanya sesuai kebijakan sekolah; attempt/revision/certificate/audit TIDAK di-hard-delete — tandai suspended/revoked.
