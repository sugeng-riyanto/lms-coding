# UI Language Policy — Coding School LMS

Audited 2026-09-08. This is the single source of truth for which surfaces are
English and which are Indonesian. When in doubt, follow the table below and the
lint rules described in "Rule scope" (both fail CI via `--max-warnings=0`).

## Policy

The whole app is **fully bilingual (English / Indonesian)** with a per-user
preference stored on `profiles.language` and mirrored to the `lms-lang` cookie
(see `lib/i18n.ts` and `features/actions.ts`). The **default is English**
(`DEFAULT_LANG = "en"`, English-first pilot); users explicitly opt into
Indonesian via the Settings page or the pre-sign-in toggle, and the choice is
persisted on first sign-in (`persistLoginLanguage`).

Two classes of surface:

| Surface | Language | Enforcement |
| --- | --- | --- |
| Public shells: landing (`app/page.tsx`), auth (`app/(auth)/**`), verifier (`app/(public)/**`), health (`app/health`), error/not-found/unauthorized/account-inactive, root layout + theme toggle | **English only** | lint rule `lms/no-indonesian-shell-text` |
| Authenticated workspaces: teacher (`app/(teacher)/**`), student (`app/(student)/**`), guardian (`app/(guardian)/**`), profile/settings | **Bilingual via `t()`/`mkT` dictionaries** — every UI string has an `id` and `en` value, rendered by the user's preference | parity unit tests + `lms/no-indonesian-shell-text` applied to the translated surfaces |

Rationale: English-first makes the pilot legible to the widest audience (the
landing page, sign-in, and certificate verification are the first and last
impression for participants, parents, and the public, and the project targets
IELTS 8.5-level copy). Indonesian remains fully supported — no student, teacher,
or guardian is forced into a language — but it is an explicit choice, not the
default.

## Rule scope (files linted)

`lms/no-indonesian-shell-text` flags unambiguous Indonesian UI literals:

1. **English-only shells**: `app/(auth)/**`, `app/(public)/**`,
   `app/error.tsx`, `app/not-found.tsx`, `app/layout.tsx`, `app/page.tsx`,
   `app/health/**`, `app/unauthorized/**`, `app/account-inactive/**`,
   `components/theme-toggle.tsx`.
2. **Translated surfaces** (`TRANSLATED_SURFACES` in `eslint.config.mjs`):
   teacher dashboard/certificates/analytics, student learn pages, and the
   charts/dashboard/anchor-status kits. A hardcoded Indonesian literal there is
   a regression — it bypasses the dictionary — so it fails CI. Dictionary
   *data* (`{ id, en }` pairs) lives in `lib/ui-text/` and is not flagged.

Pages outside these two scopes (deep activity/quiz pages that still render
Indonesian) are tracked as follow-up translation work, not silently linted.

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

## Data vs chrome

User-generated content (course titles, student names, lesson objectives,
teacher notes) is **content**, not UI chrome — it renders as authored in both
languages. Only framework labels, navigation, buttons, empty states, and
system messages are translated.

## History

- 2026-09-08: policy written. Translated `app/health` and the public verifier
  to English; the auth shells had already been unified in commit `ea4c4c1`.
- 2026-09-08: full app made bilingual via per-page dictionaries
  (`lib/ui-text/`), per-user preference, and language-aware message libs;
  shells remained English-only (commit `a23f128` + `8777c2d`).
- 2026-09-08: **default language changed to English** (`DEFAULT_LANG`,
  login fallback, and `<html lang>` all resolve to `en` until the user picks
  otherwise). The `profiles.language` column default stays `'id'`
  deliberately — that stored value is the "never chose" sentinel for
  `persistLoginLanguage`, not a UI default.