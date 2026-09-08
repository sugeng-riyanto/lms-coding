# UI Language Policy — Coding School LMS

Audited 2026-09-08. This is the single source of truth for which surfaces are
English and which are Indonesian. When in doubt, follow the table below and the
lint rule `lms/no-indonesian-shell-text` (warn, fails CI via `--max-warnings=0`).

## Policy

The **public pilot speaks English**; the **authenticated role dashboards stay
professional Indonesian** (a deliberate product decision for the school pilot —
see the redaksional request that introduced Bahasa Indonesia UI).

| Surface | Language | Examples |
| --- | --- | --- |
| Public landing (`app/page.tsx`) | English | hero, features, roles, footer |
| Auth shell (`app/(auth)/**`) | English | Sign in, Password, "Use the account provided by your school" |
| Public verifier (`app/(public)/**`) | English | Certificate verification, Recipient, Issued, matches |
| Public health (`app/health`) | English | Service status |
| Error / not-found / unauthorized / account-inactive | English | Something went wrong, Page not found, No access |
| Root layout + shared chrome (`app/layout.tsx`, `components/theme-toggle.tsx`) | English | Skip to main content, Toggle light/dark theme |
| Teacher dashboard (`app/(teacher)/**`) | Indonesian | Dasbor Kelas, Matriks cohort, Antrian penilaian |
| Student dashboard (`app/(student)/**`) | Indonesian | Ruang belajar, Target mingguan, Jalur level |
| Guardian dashboard (`app/(guardian)/**`) | Indonesian | Ringkasan |
| Profile / settings | Indonesian | Pengaturan |

Rationale: the landing page, sign-in, and certificate verification are the
first and last impression for participants, parents, and the public — English
makes the pilot legible to the widest audience and matches the international
standard the project is built toward (IELTS 8.5-level copy). Inside the
workspaces, teachers/students already work in Bahasa Indonesia; keep their
labels consistent there rather than mixing.

## Rule scope (files linted for English)

`lms/no-indonesian-shell-text` is applied **only** to shell paths:

- `app/(auth)/**`, `app/(public)/**`
- `app/error.tsx`, `app/not-found.tsx`, `app/layout.tsx`, `app/page.tsx`,
  `app/health/**`
- `app/unauthorized/**`, `app/account-inactive/**`
- `components/theme-toggle.tsx`

Authenticated workspaces (`app/(teacher)/**`, `app/(student)/**`,
`app/(guardian)/**`, `app/profile/**`, `app/settings/**`) are intentionally
excluded — they are Indonesian by design.

## How the rule works

It scans JSX text, JSX attribute string values (`aria-label`, `title`,
`placeholder`, `alt`), and plain string/template literals for a curated list of
unambiguous Indonesian UI words (word-boundary, case-insensitive): `masuk`,
`kata sandi`, `simpan`, `batal`, `hapus`, `tambah`, `beranda`, `pengaturan`,
`lanjutkan`, `belajar`, `murid`, `guru`, `wali`, `kelas`, `nilai`, `soal`,
`ujian`, `sertifikat`, `verifikasi`, `analitik`, `antrian`, `penilaian`,
`matriks`, `sinyal`, `risiko`, `muat`, `perbarui`, `tidak ditemukan`, `terjadi
kesalahan`, `kembali`, `unduh`, `penerima`, `terbit`, `cocok`, `menunggu`,
`berhasil`, `gagal`, `daftar`, `lihat`, `buka`, `tutup`.

Add new words to the list in `eslint.config.mjs` when you spot an Indonesian
UI string in a shell component. English words that happen to appear inside
Indonesian text (e.g. "level", "course", "status") are not flagged — the list
is intentionally curated to avoid false positives.

## History

- 2026-09-08: policy written. Translated `app/health` and the public verifier
  (`app/(public)/verify/[publicId]/page.tsx`) to English; the auth shells had
  already been unified in commit `ea4c4c1`.