# Acceptance Criteria

## Auth and permissions

- [ ] Guru dan murid dapat login/logout dan session refresh bekerja.
- [ ] Semua exposed tables RLS-enabled.
- [ ] Seluruh denial tests di `RBAC.md` lulus.
- [ ] Role tidak dapat diubah dari browser/user metadata.

## Learning

- [ ] Course hierarchy dapat dibuat, dipreview, dipublish, dan versioned.
- [ ] Murid hanya melihat enrollment aktif.
- [ ] Resume dan autosave pulih setelah refresh.
- [ ] Prerequisite dan unlock dihitung server-side.
- [ ] Next-best-action menjelaskan alasan rekomendasi.

## Assessment

- [ ] Attempt history append-only dan submit idempotent.
- [ ] Answer key tidak muncul di client sebelum release policy.
- [ ] Objective scoring cocok dengan fixtures.
- [ ] Manual grade dan revision dapat diaudit.
- [ ] Competency mastery dapat ditelusuri ke evidence.

## Dashboard

- [ ] Class totals cocok dengan raw fixture data.
- [ ] Guru dapat drill down tanpa melihat organisasi lain.
- [ ] Alerts explainable dan dapat diselesaikan.
- [ ] CSV export aman dari formula injection.

## Certificate

- [ ] PDF A4 rapi pada print preview.
- [ ] QR menuju HTTPS verifier.
- [ ] Hash deterministik dan perubahan payload terdeteksi.
- [ ] Public verifier tidak membocorkan PII/score detail.
- [ ] Revocation dan reissue bekerja.
- [x] UI tidak mengklaim blockchain verified saat anchor belum final.

## Quality

- [ ] Mobile 360px dan desktop 1440px berfungsi.
- [ ] Keyboard-only critical paths berfungsi.
- [ ] Loading, empty, offline, forbidden, and error states tersedia.
- [ ] Lint, typecheck, tests, production build, dan security checks lulus.
- [ ] README deployment dan operational runbooks akurat.

