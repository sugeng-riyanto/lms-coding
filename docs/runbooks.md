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
1. Ambil backup point terbaru (point-in-time di Supabase dashboard, atau
   `pg_dump` untuk clone). Restore ke project/DB ISOLATED dulu — jangan pernah
   langsung ke produksi.
2. **Rehearsal otomatis (terisolasi, tanpa menyentuh produksi):**
   `bash scripts/restore-rehearsal/run.sh` — membangun sumber "seperti produksi"
   (shim + migration repo verbatim + grants + seed + fixture), membuat artefak
   backup `pg_dump`, me-restore ke DB baru yang kosong, lalu memverifikasi: RLS
   aktif di semua exposed table, baris pokok hadir, dan anonim tetap 0 baris
   (output `PASS=n FAIL=0`). Env: `PGHOST/PGPORT/PGUSER/PGPASSWORD`,
   `RR_KEEP=1` untuk inspeksi, DB default `lms_rr_src`/`lms_rr_dst`.
3. Setelah restore di lingkungan uji: `npm run db:typecheck` + verifikasi smoke
   (login, submit, dashboard, PDF, verifier) sebelum swap.
4. Swap hanya setelah smoke test hijau; simpan artefak backup + log di tempat
   aman (contoh artefak: `.freebuff/restore-rehearsal/backup-*.sql`).

## 6. Revoke exposed secret
1. Rotate di Supabase dashboard + env server (jangan commit).
2. Revoke signed URL lama; PDF di private bucket aman (butuh permission check baru).
3. Grep repo + bundle: pastikan tidak ada `sb_secret`/answer key di client.

## 7. Privacy / data correction request
1. Verifikasi identitas pemohon (wali hanya via guardian link aktif).
2. Koreksi via UPDATE dengan audit log before/after (redact token/email/nilai dari log teks).
3. Retention: hapus hanya sesuai kebijakan sekolah; attempt/revision/certificate/audit TIDAK di-hard-delete — tandai suspended/revoked.

## 8. Checklist setelah setiap perubahan database
Setiap migration baru WAJIB melewati, sebelum merge:
1. `npm run db:typecheck` (DB advisor statis — scan seluruh migration).
2. `bash scripts/live-denial/run.sh` (RLS/denial sungguhan di Postgres — semua
   migration diterapkan verbatim; target PASS=95+, FAIL=0).
3. `bash scripts/restore-rehearsal/run.sh` (restore rehearsal — bukti artefak
   backup→restore tetap sehat).
4. Secret scan (`grep` service role/answer key di luar node_modules; lihat
   PROGRESS) — cepat sebelum commit.
CI (`.github/workflows/ci.yml`) menjalankan 1–3 otomatis per push/PR
(`verify` → `live-denial` + `restore-rehearsal` + `e2e`); e2e hermetic men-skip
spec yang butuh session bila tanpa env Supabase (tanpa `.env` di CI).
