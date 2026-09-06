# Live-DB RLS / Denial Suite (tanpa Docker)

Menjalankan seluruh skenario denial `RBAC.md` sebagai **SQL sungguhan terhadap
Postgres**, bukan regex statis. Ini mengangkat batasan "bukti statis" dari
`tests/integration/rls.test.ts` dan `security.test.ts`.

## Prasyarat

- PostgreSQL **14+** lokal (divalidasi pada Postgres 18), server berjalan, dan
  user superuser (mis. `postgres`) bisa `psql` masuk.
- Tidak butuh Docker/Supabase: harness meniru permukaan Supabase yang
  diperlukan (role `anon`/`authenticated`, `auth.uid()` dari GUC
  `request.jwt.claims`, `auth.users`/`identities`, `storage`, pgcrypto di
  schema `extensions`) di `00_shim.sql`.

> Mengapa ini sah? RLS/denial diuji di lapisan Postgres — PostgREST/GoTrue
> tidak terlibat dalam evaluasi policy. `set role authenticated` +
> `set_config('request.jwt.claims', '{"sub": "..."}', false)` mereproduksi
> persis identitas yang dikirim Supabase per request.

## Jalankan

```bash
# Windows (Git Bash) — arahkan PSQL bila tidak di PATH:
export PSQL="/c/Program Files/PostgreSQL/18/bin/psql"
bash scripts/live-denial/run.sh
```

Env opsional: `PGHOST` `PGPORT` `PGUSER` `PGPASSWORD` `LMS_DENIAL_DB`
(default `lms_rls_test`).

## Alur `run.sh` (urutan penting)

1. `00_shim.sql` — tiruan permukaan Supabase (roles, auth, storage, pgcrypto).
2. `supabase/migrations/*.sql` — **migration repo dijalankan verbatim**;
   `check_function_bodies=off` meniru runner Supabase (fungsi SQL boleh
   didefinisikan sebelum tabelnya ada).
3. `05_grants.sql` — grant default Supabase (table/sequence ke
   `anon`/`authenticated`) agar RLS-lah yang memutuskan akses.
4. `supabase/seed.sql` — seed anonim repo (1 guru, 1 cohort, 3 murid).
5. `10_fixture.sql` — org ke-2 + guru-2, wali tertaut & tak tertaut, chain
   konten + attempt, storage objects; id UUID tetap (awalan `a1`/`b1`).
6. `20_denial.sql` — suite denial: tiap blok `set role` + identitas lalu
   menguji policy; hasil ditulis ke `public.harness_results` dan runner
   mencetak `PASS`/`FAIL` + summary.

DB tidak di-drop sesudahnya agar bisa diinspeksi:
`psql -d lms_rls_test -c "select * from public.harness_results order by id;"`.

## Coverage (check id → skenario RBAC.md)

| Grup | Check | Skenario |
|---|---|---|
| Murid A vs B | `p01_*`, `t01_b_*`, `t01_c_as_b_own_visible` | A melihat data sendiri; **A tidak bisa membaca profil/membership/enrollment B** |
| Integritas role & data | `t02_*`, `p02_own_profile_upd` | A tak bisa ubah role, ubah profil B, ubah score attempt, atau insert membership sendiri; A bisa update profil sendiri |
| Guru org-1 vs org-2 | `t03_*`, `p03_*`, `p03d_*`, `t03d_*`, `t03e_*` | **Guru org-1 tidak melihat cohort/course/profil/membership org-2**; guru hanya grade cohort sendiri; guru org-2 melihat muridnya sendiri, bukan murid org-1 |
| Wali | `p04_*`, `t04_*` | Wali melihat anak tertaut; anak tak tertaut tersembunyi; insert link ditolak |
| Anonim | `t05_*` | anon: 0 baris pada tabel privat, verifier view tetap jalan (minimal PII), insert ditolak |
| PII minimal | `t06_view_minimal_pii` | view verifier tidak membocorkan PII |
| Sertifikat & storage | `p07_*`, `t07_*`, `p08_*`, `t08_*` | guru revoke cert cohort sendiri; murid tak bisa revoke; upload folder sendiri OK; tulis folder murid lain ditolak |

## Bug nyata yang suite ini temukan (migration `…000008_rls_recursion_fix.sql`)

1. **Infinite recursion RLS** — policy pada `profiles`/`cohort_members`/`cohorts`
   saling referensi melalui subquery yang subject-RLS, sehingga `select` apa pun
   sebagai `authenticated` error `infinite recursion detected in policy`.
   Perbaikan: lookup diarahkan lewat helper security-definer (mematikan RLS pada
   tabel antara, semantik akses sama).
2. **Helper `private.*` tanpa EXECUTE untuk `authenticated`** — helper
   security-definer di-revoke dari PUBLIC tetapi tidak pernah di-grant ke
   `authenticated`, sehingga tiap policy yang memakainya gagal runtime dengan
   `permission denied for function`. Perbaikan: `grant execute … to
   authenticated` pada helper yang dipakai policy.

Keduanya tak terlihat oleh pengujian statis (regex/advisor) — hanya eksekusi
sungguhan yang menangkapnya.
