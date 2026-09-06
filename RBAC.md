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

## Denial tests wajib

1. Murid A tidak dapat membaca profile, attempt, grade, atau certificate Murid B.
2. Murid tidak dapat mengubah score, completion, enrollment, role, atau certificate.
3. Guru A tidak dapat melihat cohort Guru B di organisasi lain.
4. Wali tidak dapat melihat anak yang belum ditautkan.
5. Pengguna anonymous tidak dapat membaca tabel internal.
6. Public verifier tidak membocorkan email, tanggal lahir, jawaban, nilai detail, atau storage path.
7. Revoked certificate tidak dapat diunduh sebagai valid.
8. Upload tidak dapat menimpa file milik pengguna lain.

