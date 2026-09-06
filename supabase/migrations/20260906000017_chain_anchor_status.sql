-- Phase 6 lanjutan: blockchain anchoring opsional (ADR-018 — keputusan manusia
-- provider/network masih PENDING; implementasi mock-only).
--
-- 1) Status anchor eksplisit: pending / final / failed (bukan boolean) agar UI
--    verifier membedakan state dan TIDAK mengklaim "blockchain verified" sebelum
--    final (ACCEPTANCE_CRITERIA Certificate).
-- 2) Verifier publik butuh status anchor — baris chain_anchors HANYA berisi
--    hash/root + transaction reference (tanpa PII/nilai), jadi read publik aman.
-- 3) certificates_public kini memuat chain_anchor_status via LEFT JOIN.

alter table public.chain_anchors
  add constraint chain_anchors_status_check
  check (status in ('pending', 'final', 'failed'));

-- Non-PII by design (ADR-018): merkle_root + transaction_ref + provider/network.
create policy chain_anchors_public_read on public.chain_anchors
  for select to anon, authenticated using (true);

create or replace view public.certificates_public
with (security_invoker = true) as
select
  c.public_id,
  c.status,
  p.display_name,
  co.title as course_title,
  l.title as level_title,
  c.issued_at,
  c.serial_no,
  c.payload_hash,
  (c.chain_anchor_id is not null) as chain_anchored,
  ca.status as chain_anchor_status
from public.certificates c
join public.enrollments e on e.id = c.enrollment_id
join public.profiles p on p.id = e.student_id
join public.courses co on co.id = e.course_id
join public.levels l on l.id = c.level_id
left join public.chain_anchors ca on ca.id = c.chain_anchor_id
where c.status in ('active', 'revoked');