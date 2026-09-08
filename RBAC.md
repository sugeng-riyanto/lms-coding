# RBAC and Authorization

## Roles

| Capability | Owner/Guru | Murid | Wali | Publik |
|---|---:|---:|---:|---:|
| Kelola course sendiri | Ya | Tidak | Tidak | Tidak |
| Kelola enrollment cohort sendiri | Ya | Tidak | Tidak | Tidak |
| Lihat semua progress cohort sendiri | Ya | Tidak | Tidak | Tidak |
| Belajar pada enrollment aktif | Ya/preview | Ya | Tidak | Tidak |
| Submit attempt atas nama diri | Tidak | Ya | Tidak | Tidak |
| Menilai manual | Ya | Tidak | Tidak | Tidak |
| Lihat ringkasan anak tertaut | Tidak | Tidak | Ya | Tidak |
| Unduh sertifikat sendiri | Tidak | Ya | Tidak | Tidak |
| Verifikasi sertifikat dengan public ID | Ya | Ya | Ya | Ya |
| Lihat nilai/jawaban dari verifier publik | Tidak | Tidak | Tidak | Tidak |

## Prinsip policy

- Semua akses dibatasi `organization_id` dan hubungan aktual.
- Murid membaca course hanya jika enrollment aktif.
- Guru membaca murid hanya jika mengajar cohort terkait.
- Wali membaca ringkasan hanya melalui guardian link yang aktif.
- Public verifier mengembalikan minimum data: status valid/revoked, nama tampilan yang disetujui, judul level, tanggal terbit, issuer, fingerprint.
- Service/secret key hanya digunakan pada trusted server untuk tugas yang benar-benar memerlukan bypass.

## Cakupan Wali — keputusan pilot (ADR-019)

Kapabilitas Wali = **`view_linked_child_summary`** (ringkasan anak tertaut-aktif
saja) + **`verify_certificate`**. Keputusan untuk pilot (lihat ADR-019):

- **Termasuk (tetap):** ringkasan agregat per anak — progress % level, mastery
  rata-rata, level tuntas, terakhir aktif, daftar enrollment aktif — plus
  **sertifikat**: status, nomor seri, tanggal terbit, **unduh PDF resmi** dan
  tautan verifikasi. RLS: `profiles`/`enrollments`/`progress_snapshots` via
  `guardian_links` aktif + `certs_guardian_select`.
- **TIDAK termasuk di pilot:** nilai quiz/ujian terperinci dan jawaban — RLS
  wali sengaja TIDAK menyentuh `attempts`/`responses`/`grade_revisions`.
- **TIDAK termasuk di pilot:** "absensi". LMS asinkron tidak punya roll-call;
  sinyal engagement = menit aktif (`study_sessions`), yang belum punya policy
  wali. Jika feedback pilot memintanya: RPC security-definer
  `guardian_child_engagement` (hanya agregat mingguan menit aktif, tanpa
  timestamp detail) + policy + denial test — bukan memperluas akses tabel.
- Revisi keputusan: hanya berdasar feedback pilot tertulis; perubahan wajib
  lewat RPC ter-guard + live-denial, bukan widening policy SELECT.

## Denial tests wajib

1. Murid A tidak dapat membaca profile, attempt, grade, atau certificate Murid B.
2. Murid tidak dapat mengubah score, completion, enrollment, role, atau certificate.
3. Guru A tidak dapat melihat cohort Guru B di organisasi lain.
4. Wali tidak dapat melihat anak yang belum ditautkan.
5. Pengguna anonymous tidak dapat membaca tabel internal.
6. Public verifier tidak membocorkan email, tanggal lahir, jawaban, nilai detail, atau storage path.
7. Revoked certificate tidak dapat diunduh sebagai valid.
8. Upload tidak dapat menimpa file milik pengguna lain.

