-- Phase 6 (KURANG): reissue sertifikat + landasan persist PDF (rencana
-- docs/plan-certificate-persist-reissue.md, slice migration).
--
-- 1) `unique (enrollment_id, level_id)` LINTAS STATUS membuat reissue mustahil:
--    baris revoked tetap memegang kunci dan issue ulang `on conflict do
--    nothing` diam-diam mengembalikan NULL. Diganti partial unique index
--    "satu ACTIVE per enrollment-level"; riwayat revoked boleh banyak
--    (append-only, no_delete_certs tetap).
-- 2) `private.reissue_certificate` = revoke baris lama + issue baris baru +
--    SATU audit 'certificate.reissued' dalam satu transaksi (definer,
--    search_path tetap, caller check). "Reissued" TIDAK jadi nilai status —
--    view verifier & RLS tidak berubah (keputusan D1 rencana).
-- 3) Retry-safe tanpa menyimpan key: panggilan kedua (baris lama sudah
--    revoked) mengembalikan sertifikat ACTIVE yang sudah ada untuk pasangan
--    yang sama — sama seperti issue_certificate, p_idempotency_key diterima
--    untuk simetri API namun idempotensi dijamin oleh state.

alter table public.certificates
  drop constraint if exists certificates_enrollment_id_level_id_key;

create unique index certificates_one_active
  on public.certificates (enrollment_id, level_id)
  where status = 'active';

-- Constraint lama dipakai `on conflict (enrollment_id, level_id)` di
-- issue_certificate. Dengan index PARTIAL, conflict target harus menyertakan
-- predikat status. Amandemen issue_certificate agar issuance biasa tetap
-- berjalan: skip hanya bila sudah ada sertifikat ACTIVE; issue ulang setelah
-- revoke (tanpa active) kini diperbolehkan membuat baris baru.
create or replace function private.issue_certificate(
  p_enrollment_id uuid,
  p_level_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  -- eligibility dievaluasi server (disederhanakan di migration; full evaluator di lib/mastery + job)
  insert into public.certificates (public_id, enrollment_id, level_id, serial_no, payload_json, payload_hash)
  values (
    replace(gen_random_uuid()::text, '-', ''),
    p_enrollment_id, p_level_id,
    'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6),
    jsonb_build_object('enrollmentId', p_enrollment_id, 'levelId', p_level_id),
    encode(digest(p_enrollment_id::text || p_level_id::text || now()::text, 'sha256'), 'hex')
  )
  on conflict (enrollment_id, level_id) where status = 'active' do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.reissue_certificate(
  p_certificate_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_enrollment uuid;
  v_level uuid;
  v_status text;
  v_new_id uuid;
  v_existing uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;

  select c.enrollment_id, c.level_id, c.status
    into v_enrollment, v_level, v_status
  from public.certificates c
  where c.id = p_certificate_id;

  if v_enrollment is null then raise exception 'NOT_FOUND'; end if;

  -- Hanya guru cohort (sama dengan revoke_certificate).
  if not exists (
    select 1 from public.enrollments e
    where e.id = v_enrollment and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;

  -- Retry-safe: bila baris lama sudah bukan active DAN sudah ada active baru
  -- untuk pasangan yang sama → anggap reissue sudah terjadi, kembalikan itu.
  if v_status <> 'active' then
    select id into v_existing
    from public.certificates
    where enrollment_id = v_enrollment and level_id = v_level and status = 'active'
    limit 1;
    if v_existing is not null then return v_existing; end if;
    raise exception 'NOT_ACTIVE';
  end if;

  -- Revoke lama (transisi status, tanpa delete) lalu issue baru di transaksi sama.
  update public.certificates
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where id = p_certificate_id and status = 'active';

  insert into public.certificates
    (public_id, enrollment_id, level_id, serial_no, payload_json, payload_hash)
  values (
    replace(gen_random_uuid()::text, '-', ''),
    v_enrollment, v_level,
    'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6),
    jsonb_build_object('enrollmentId', v_enrollment, 'levelId', v_level),
    encode(digest(v_enrollment::text || v_level::text || now()::text, 'sha256'), 'hex')
  )
  returning id into v_new_id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, before_json, after_json)
  values (
    auth.uid(), 'certificate.reissued', 'certificate', p_certificate_id::text,
    jsonb_build_object('status', 'active'),
    jsonb_build_object('reason', p_reason, 'oldId', p_certificate_id::text, 'newId', v_new_id::text)
  );

  return v_new_id;
end;
$$;

-- Wrapper public + grant (pola issue/revoke_certificate).
create or replace function public.reissue_certificate(
  p_certificate_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language sql security definer set search_path = private, public, pg_temp
as $$
  select private.reissue_certificate(p_certificate_id, p_reason, p_idempotency_key);
$$;

revoke all on function public.reissue_certificate(uuid, text, text) from public;
grant execute on function public.reissue_certificate(uuid, text, text) to authenticated;
