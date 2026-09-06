# Security and Student Privacy

## Data minimization

- Kumpulkan data minimum untuk pembelajaran.
- Hindari tanggal lahir lengkap jika tidak diperlukan.
- Gunakan display name pada sertifikat berdasarkan consent.
- Pisahkan public verification data dari profile internal.
- Definisikan retention dan deletion workflow sebelum produksi.

## Authentication

- Email/password atau magic link sesuai kebijakan sekolah.
- Teacher account wajib MFA jika tersedia.
- Rate limit login, reset password, assessment submit, verifier, dan exports.
- Verifikasi identity server-side; jangan mengandalkan object session yang belum divalidasi.
- Session dan CSRF protection mengikuti pola resmi framework/Supabase terbaru.

## Authorization

- RLS di semua tabel public/exposed.
- `TO authenticated` harus disertai ownership/relationship predicate.
- Role tidak berasal dari user-editable metadata.
- Storage bucket submissions/certificates private; download menggunakan short-lived signed URL setelah permission check.

## Application security

- CSP ketat, secure headers, output encoding, upload MIME/size validation.
- Batasi file: PDF/image yang disetujui; rename server-side; scan malware jika deployment mendukung.
- Secret hanya di server environment.
- Redact token, email, jawaban, dan nilai dari log.
- Audit log untuk role, enrollment, grade revision, content publishing, issuance/revocation, dan export.

## Child safety

- Tidak ada direct messaging bebas pada MVP.
- Feedback guru dapat diaudit.
- Tidak ada leaderboard publik per murid.
- Consent dan kebijakan sekolah menentukan akses wali, penggunaan nama pada sertifikat, dan retention.
- Sediakan mekanisme koreksi data dan penonaktifan akun.

## Threat scenarios

- IDOR/BOLA antar murid/cohort.
- Manipulasi score dari browser.
- Replay submit atau completion event Roblox.
- Answer key bocor melalui API/client bundle.
- CSV formula injection.
- Malicious upload.
- QR ditebak/scrape massal.
- Certificate diganti setelah hash dibuat.

Setiap skenario harus memiliki integration/denial test.

