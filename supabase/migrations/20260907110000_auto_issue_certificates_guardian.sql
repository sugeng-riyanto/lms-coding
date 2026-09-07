-- Auto-issue sertifikat + rilis ke wali + katalog published untuk murid.
-- 1) `private.auto_issue_certificates(p_enrollment_id)` — aturan guru:
--    SEMUA aktivitas wajib dari lesson wajib level selesai DAN
--    quiz 100% DAN ujian akhir >= 70%. Evaluasi penuh di SERVER (murid tak
--    bisa memalsukan skor; hanya skor dari attempts yang di-grade server).
--    Dipanggil dari recomputeProgress (server action) setelah submit kuis/ujian.
--    Idempoten: sertifikat ACTIVE yang sudah ada untuk (enrollment, level)
--    di-skip via partial unique index `certificates_one_active`.
-- 2) `certs_guardian_select` — rilis otomatis ke wali: wali dengan guardian
--    link AKTIF ke murid dapat MEMBACA sertifikat (portal wali + unduh PDF),
--    tanpa jawaban/nilai detail (kebijakan minimum disclosure tetap).
-- 3) `courses_student_browse_published` — katalog murid menampilkan semua
--    kursus PUBLISHED di org (metadata: judul/deskripsi/status); draft & konten
--    lesson tetap tertutup (policy level/lesson/activity tidak berubah).

create or replace function private.auto_issue_certificates(p_enrollment_id uuid)
returns integer
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_student uuid;
  v_course uuid;
  v_version uuid;
  v_issued integer := 0;
  v_level record;
  v_lessons_done boolean;
  v_req_lesson uuid;
  v_exam_assessment uuid;
  v_exam_score numeric;
  v_quiz_score numeric;
  v_cert_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;

  select student_id, course_id into v_student, v_course
  from public.enrollments where id = p_enrollment_id;
  if v_course is null then raise exception 'NOT_FOUND'; end if;

  -- Caller = murid enrollment ATAU guru cohort (pola revoke_certificate).
  if v_student <> auth.uid() and not exists (
    select 1 from public.enrollments e
    where e.id = p_enrollment_id and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;

  select id into v_version from public.course_versions
  where course_id = v_course and published_at is not null
  order by version desc limit 1;
  if v_version is null then return 0; end if;

  for v_level in
    select id from public.levels where course_version_id = v_version order by position
  loop
    -- Sudah ada sertifikat ACTIVE untuk pasangan ini → skip (idempoten).
    if exists (
      select 1 from public.certificates c
      where c.enrollment_id = p_enrollment_id and c.level_id = v_level.id and c.status = 'active'
    ) then continue; end if;

    -- Semua aktivitas wajib dari setiap lesson wajib level ini harus selesai.
    v_lessons_done := true;
    for v_req_lesson in
      select le.id from public.lessons le
      join public.modules m on m.id = le.module_id
      where m.level_id = v_level.id and le.required
    loop
      if not exists (
        select 1 from public.activities a
        where a.lesson_id = v_req_lesson and a.required
          and exists (
            select 1 from public.learning_events ev
            where ev.enrollment_id = p_enrollment_id
              and ev.entity_type = 'activity' and ev.entity_id = a.id
              and ev.event_type = 'activity_completed'
          )
      ) then v_lessons_done := false; exit; end if;
    end loop;
    if not v_lessons_done then continue; end if;

    -- Ujian akhir = assessment TERAKHIR di level (posisi aktivitas terbesar).
    select aq.id into v_exam_assessment
    from public.assessments aq
    join public.activities ac on ac.id = aq.activity_id
    join public.lessons le on le.id = ac.lesson_id
    join public.modules m on m.id = le.module_id
    where m.level_id = v_level.id
    order by ac.position desc, aq.id desc
    limit 1;

    select coalesce(max(at.final_score), -1) into v_exam_score
    from public.attempts at
    where at.assessment_id = v_exam_assessment
      and at.enrollment_id = p_enrollment_id
      and at.status <> 'in_progress';

    -- Quiz = skor terbaik di assessment mana pun di level (termasuk ujian).
    select coalesce(max(x.best), -1) into v_quiz_score
    from (
      select max(at2.final_score) as best
      from public.assessments aq2
      join public.activities ac2 on ac2.id = aq2.activity_id
      join public.lessons le2 on le2.id = ac2.lesson_id
      join public.modules m2 on m2.id = le2.module_id
      join public.attempts at2 on at2.assessment_id = aq2.id
      where m2.level_id = v_level.id
        and at2.enrollment_id = p_enrollment_id
        and at2.status <> 'in_progress'
      group by aq2.id
    ) x;

    -- Aturan: quiz 100% DAN ujian akhir >= 70%.
    if v_quiz_score >= 100 and v_exam_score >= 70 then
      insert into public.certificates
        (public_id, enrollment_id, level_id, serial_no, payload_json, payload_hash)
      values (
        replace(gen_random_uuid()::text, '-', ''),
        p_enrollment_id, v_level.id,
        'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6),
        jsonb_build_object('enrollmentId', p_enrollment_id, 'levelId', v_level.id),
        private.sha256_hex(p_enrollment_id::text || v_level.id::text || now()::text)
      )
      on conflict (enrollment_id, level_id) where status = 'active' do nothing
      returning id into v_cert_id;
      if v_cert_id is not null then
        v_issued := v_issued + 1;
        insert into public.audit_logs (actor_id, action, target_type, target_id, after_json)
        values (auth.uid(), 'certificate.auto_issued', 'certificate', v_cert_id::text,
                jsonb_build_object('enrollmentId', p_enrollment_id, 'levelId', v_level.id,
                                   'quizScore', v_quiz_score, 'examScore', v_exam_score));
      end if;
    end if;
  end loop;

  return v_issued;
end;
$$;

-- Wrapper public + grant (pola RPC lain).
create or replace function public.auto_issue_certificates(p_enrollment_id uuid)
returns integer language sql security definer set search_path = private, public, pg_temp
as $$ select private.auto_issue_certificates(p_enrollment_id); $$;

revoke all on function public.auto_issue_certificates(uuid) from public;
grant execute on function public.auto_issue_certificates(uuid) to authenticated;

-- Rilis otomatis ke wali: wali dengan guardian link AKTIF ke murid dapat
-- membaca sertifikat (portal wali + unduh PDF). Minimum disclosure tetap.
create policy certs_guardian_select on public.certificates for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    join public.guardian_links gl on gl.student_id = e.student_id
    where e.id = certificates.enrollment_id
      and gl.guardian_id = auth.uid()
      and gl.status = 'active'
  ));

-- Katalog murid: tampilkan SEMUA kursus published (metadata judul/deskripsi),
-- bukan hanya yang sudah di-enroll. Draft tetap tak terlihat murid.
create policy courses_student_browse_published on public.courses for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.course_versions cv
      where cv.course_id = courses.id and cv.published_at is not null
    )
  );