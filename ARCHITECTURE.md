# Architecture

## Komponen

- Next.js: UI, Server Actions/Route Handlers, authorization boundary.
- Supabase Auth: identitas dan session.
- Postgres: course, enrollment, progress, attempts, grades, certificates, audit.
- Storage private buckets: submissions dan certificate PDF.
- Realtime: pembaruan dashboard yang dibatasi; polling fallback.
- Edge/server function: finalisasi attempt, agregasi progress, certificate generation, notification jobs.
- Optional chain adapter: anchor Merkle root atau hash sertifikat.

## Boundary

Browser hanya boleh mengirim event/fakta: membuka lesson, menyimpan draft, mengirim jawaban. Browser tidak boleh menentukan nilai, completion, role, certificate status, atau unlock.

## Struktur aplikasi target

```text
app/
  (public)/verify/[publicId]/
  (auth)/login/
  (student)/learn/
  (teacher)/teacher/
  api/
components/
features/{auth,courses,learning,assessment,analytics,certificates}/
lib/{auth,supabase,validation,permissions,crypto}/
supabase/{migrations,seed.sql,tests}/
tests/{unit,integration,e2e}/
```

## Reliability

- Gunakan idempotency key untuk submit attempt dan generate certificate.
- Progress derived dari immutable learning events/attempts plus projection table.
- Recompute projection harus aman dijalankan ulang.
- Semua job memiliki status `queued|running|succeeded|failed`, attempt count, dan last error tersanitasi.

