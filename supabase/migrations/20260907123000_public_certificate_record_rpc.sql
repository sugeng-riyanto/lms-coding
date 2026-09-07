-- Public certificate DIGITAL RECORD RPC — melengkapi get_public_certificate (000019)
-- dengan data yang dibutuhkan verifikasi pihak ketiga secara machine-readable:
-- payload_hash PENUH + kelengkapan konten PER MODUL. Aritmetika kelengkapan
-- identik dengan PDF halaman 2 dan panel "Rekam digital" di /verify (satu sumber
-- kebenaran: kegiatan wajib per lesson wajib, snapshots progress, learning_events).
--
-- Postur keamanan sama dengan 000019:
--   - security definer + search_path di-pin (private, public, pg_temp);
--   - revoke PUBLIC + grant anon/authenticated → satu-satunya permukaan anon
--     (view certificates_public TETAP security_invoker = 0 baris untuk anon);
--   - output whitelist: TANPA email, jawaban, nilai detail, waktu belajar,
--     storage path, atau id internal — hanya metadata sertifikat yang sudah
--     publik di /verify ditambah hash dan agregat kelengkapan kurikulum.
--
-- Catatan kelengkapan (harus identik dengan PDF halaman 2):
--   lessons/activities "completed" menghitung apa pun yang TUNTAS (termasuk
--   opsional); "total" hanya yang required; percent = completed / total required.
--   Untuk sertifikat ACTIVE semua kegiatan wajib sudah selesai (syarat terbit).

create or replace function public.get_public_certificate_record(p_public_id text)
returns jsonb
language plpgsql security definer set search_path = private, public, pg_temp
as $$
declare
  v_status text;
  v_display text;
  v_course text;
  v_level_title text;
  v_issued timestamptz;
  v_serial text;
  v_hash text;
  v_anchored boolean;
  v_anchor_status text;
  v_enrollment uuid;
  v_level uuid;
  v_modules jsonb;
  v_req_lessons bigint := 0;
  v_done_lessons bigint := 0;
  v_req_acts bigint := 0;
  v_done_acts bigint := 0;
  v_total bigint;
  v_done bigint;
  v_content_pct integer := 100;
begin
  -- Validasi format sebelum query apa pun (hanya [a-z0-9-], maks 80).
  if p_public_id is null
     or length(p_public_id) > 80
     or p_public_id !~ '^[a-z0-9-]+$' then
    return null;
  end if;

  select c.status, c.enrollment_id, c.level_id,
         p.display_name, co.title, l.title,
         c.issued_at, c.serial_no, c.payload_hash,
         (c.chain_anchor_id is not null), ca.status
    into v_status, v_enrollment, v_level,
         v_display, v_course, v_level_title,
         v_issued, v_serial, v_hash, v_anchored, v_anchor_status
  from public.certificates c
  join public.enrollments e on e.id = c.enrollment_id
  join public.profiles p on p.id = e.student_id
  join public.courses co on co.id = e.course_id
  join public.levels l on l.id = c.level_id
  left join public.chain_anchors ca on ca.id = c.chain_anchor_id
  where c.public_id = p_public_id
    and c.status in ('active', 'revoked')
  limit 1;

  if v_status is null then
    return null;
  end if;
  if v_status = 'revoked' then
    return jsonb_build_object('status', 'revoked', 'issuedAt', v_issued);
  end if;

  -- Kelengkapan per modul (lateral count per modul level ini).
  select coalesce(jsonb_agg(mod_json order by pos), '[]'::jsonb)
    into v_modules
  from (
    select jsonb_build_object(
             'position', m.position,
             'title', m.title,
             'lessonsCompleted', dl.cnt,
             'lessonsTotal', rl.cnt,
             'activitiesCompleted', da.cnt,
             'activitiesTotal', ra.cnt,
             'percent', case
               when (rl.cnt + ra.cnt) > 0
                 then round((100.0 * (dl.cnt + da.cnt)) / (rl.cnt + ra.cnt))::integer
               else 100
             end
           ) as mod_json,
           m.position as pos
    from public.modules m
    left join lateral (
      select count(*)::bigint as cnt
      from public.lessons l
      where l.module_id = m.id and l.required
    ) rl on true
    left join lateral (
      select count(*)::bigint as cnt
      from public.lessons l
      where l.module_id = m.id
        and exists (
          select 1 from public.progress_snapshots ps
          where ps.enrollment_id = v_enrollment
            and ps.entity_type = 'lesson' and ps.entity_id = l.id
            and (ps.status = 'completed' or ps.percent >= 100)
        )
    ) dl on true
    left join lateral (
      select count(*)::bigint as cnt
      from public.activities a
      join public.lessons l2 on l2.id = a.lesson_id and l2.module_id = m.id
      where a.required
    ) ra on true
    left join lateral (
      select count(*)::bigint as cnt
      from public.activities a
      join public.lessons l2 on l2.id = a.lesson_id and l2.module_id = m.id
      where exists (
        select 1 from public.learning_events ev
        where ev.enrollment_id = v_enrollment
          and ev.event_type = 'activity_completed'
          and ev.entity_type = 'activity' and ev.entity_id = a.id
      )
    ) da on true
    where m.level_id = v_level
  ) sub;

  -- Agregat level (identik dengan aritmetika PDF halaman 2 / Rekam digital).
  select
    (select count(*)::bigint
       from public.lessons l
       join public.modules m on m.id = l.module_id
      where m.level_id = v_level and l.required),
    (select count(*)::bigint
       from public.lessons l
       join public.modules m on m.id = l.module_id
      where m.level_id = v_level
        and exists (
          select 1 from public.progress_snapshots ps
          where ps.enrollment_id = v_enrollment
            and ps.entity_type = 'lesson' and ps.entity_id = l.id
            and (ps.status = 'completed' or ps.percent >= 100)
        )),
    (select count(*)::bigint
       from public.activities a
       join public.lessons l3 on l3.id = a.lesson_id
       join public.modules m3 on m3.id = l3.module_id
      where m3.level_id = v_level and a.required),
    (select count(*)::bigint
       from public.activities a
       join public.lessons l3 on l3.id = a.lesson_id
       join public.modules m3 on m3.id = l3.module_id
      where m3.level_id = v_level
        and exists (
          select 1 from public.learning_events ev
          where ev.enrollment_id = v_enrollment
            and ev.event_type = 'activity_completed'
            and ev.entity_type = 'activity' and ev.entity_id = a.id
        ))
  into v_req_lessons, v_done_lessons, v_req_acts, v_done_acts;

  v_total := v_req_lessons + v_req_acts;
  v_done := v_done_lessons + v_done_acts;
  if v_total > 0 then
    v_content_pct := round((100.0 * v_done) / v_total)::integer;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'displayName', v_display,
    'courseTitle', v_course,
    'levelTitle', v_level_title,
    'issuedAt', v_issued,
    'serialNo', v_serial,
    'payloadHash', v_hash,
    'chainAnchored', v_anchored,
    'chainAnchorStatus', v_anchor_status,
    'contentPercent', v_content_pct,
    'modules', v_modules
  );
end;
$$;

revoke all on function public.get_public_certificate_record(text) from public;
grant execute on function public.get_public_certificate_record(text) to anon, authenticated;
