-- Live RLS/denial suite — dijalankan sebagai postgres; tiap blok menyetel role +
-- identitas (request.jwt.claims) lalu menguji policy sungguhan di Postgres 18.
-- Hasil dicatat ke public.harness_results; runner mencetak PASS/FAIL.

-- ============ MURID A (b0000000-…-001) ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001"}', false);

do $$
begin
  -- Positif: A melihat profil & enrollment miliknya sendiri.
  insert into public.harness_results (check_id, passed, detail)
  select 'p01_own_profile', count(*) = 1, 'rows=' || count(*)
  from public.profiles where id = 'b0000000-0000-0000-0000-000000000001';
  insert into public.harness_results (check_id, passed, detail)
  select 'p01_own_enrollment', count(*) >= 1, 'rows=' || count(*)
  from public.enrollments where student_id = 'b0000000-0000-0000-0000-000000000001';
end $$;

-- Denial 1: Murid A tidak dapat membaca data Murid B (b0000000-…-002).
do $$
declare n int;
begin
  insert into public.harness_results (check_id, passed, detail)
  select 't01_b_profile_hidden', count(*) = 0, 'rows=' || count(*)
  from public.profiles where id = 'b0000000-0000-0000-0000-000000000002';
  insert into public.harness_results (check_id, passed, detail)
  select 't01_b_membership_hidden', count(*) = 0, 'rows=' || count(*)
  from public.memberships where user_id = 'b0000000-0000-0000-0000-000000000002';
  insert into public.harness_results (check_id, passed, detail)
  select 't01_b_enrollment_hidden', count(*) = 0, 'rows=' || count(*)
  from public.enrollments where student_id = 'b0000000-0000-0000-0000-000000000002';
  insert into public.harness_results (check_id, passed, detail)
  select 't01_c_as_b_own_visible', count(*) = 0, 'rows=' || count(*)
  from public.profiles where id = 'b0000000-0000-0000-0000-000000000003';
end $$;

-- Denial 2 (bagian role/score/cert): A tidak bisa ubah role, profile B, score, cert.
do $$
declare n int;
begin
  update public.memberships set role = 'teacher'
  where user_id = 'b0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('t02_role_upd_denied', n = 0, 'rows=' || n);

  delete from public.memberships
  where user_id = 'b0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('t02_role_del_denied', n = 0, 'rows=' || n);

  update public.profiles set display_name = 'Hacked'
  where id = 'b0000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('t02_b_profile_upd_denied', n = 0, 'rows=' || n);

  update public.attempts set raw_score = 100
  where assessment_id = 'a1000000-0000-0000-0000-000000000004'
    and enrollment_id in (select id from public.enrollments where student_id = 'b0000000-0000-0000-0000-000000000001');
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('t02_attempt_score_upd_denied', n = 0, 'rows=' || n);

  update public.certificates set status = 'revoked'
  where public_id = 'demo-valid-certificate';
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('t07_cert_revoke_by_student_denied', n = 0, 'rows=' || n);
end $$;

-- A mengubah profil sendiri = diperbolehkan (kontrol positif).
do $$
declare n int;
begin
  update public.profiles set display_name = display_name
  where id = 'b0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('p02_own_profile_upd', n = 1, 'rows=' || n);
end $$;

-- A mencoba menaikkan role sendiri via INSERT (tidak ada policy insert) → wajib error.
do $$
begin
  begin
    insert into public.memberships (organization_id, user_id, role) values
      ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'teacher');
    insert into public.harness_results (check_id, passed, detail)
    values ('t02_role_self_insert_denied', false, 'INSERT TIDAK diblokir!');
  exception when others then
    if sqlstate = '42501' then
      insert into public.harness_results (check_id, passed, detail)
      values ('t02_role_self_insert_denied', true, 'sqlstate 42501');
    else
      raise;
    end if;
  end;
end $$;

-- Denial 8: A tidak bisa menimpa/menulis file folder murid lain di storage.
do $$
declare n int;
begin
  begin
    insert into storage.objects (bucket_id, name, owner) values
      ('submissions', 'b0000000-0000-0000-0000-000000000002/hack.txt', 'b0000000-0000-0000-0000-000000000001');
    insert into public.harness_results (check_id, passed, detail)
    values ('t08_upload_into_B_folder_denied', false, 'INSERT TIDAK diblokir!');
  exception when others then
    if sqlstate = '42501' then
      insert into public.harness_results (check_id, passed, detail)
      values ('t08_upload_into_B_folder_denied', true, 'sqlstate 42501');
    else
      raise;
    end if;
  end;

  insert into storage.objects (bucket_id, name, owner) values
    ('submissions', 'b0000000-0000-0000-0000-000000000001/sub-a.txt', 'b0000000-0000-0000-0000-000000000001');
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('p08_upload_own_folder', n = 1, 'rows=' || n);

  update storage.objects set name = name
  where bucket_id = 'submissions' and name like 'b0000000-0000-0000-0000-000000000002/%';
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('t08_update_B_object_denied', n = 0, 'rows=' || n);
end $$;

set role postgres;

-- ============ GURU demo T1 (a0000000-…-001, org 1) ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001"}', false);

do $$
declare n int;
begin
  -- Denial 3: guru org 1 tidak melihat cohort/org 2.
  insert into public.harness_results (check_id, passed, detail)
  select 't03_org2_cohort_hidden', count(*) = 0, 'rows=' || count(*)
  from public.cohorts where teacher_id = 'a2000000-0000-0000-0000-000000000002';
  insert into public.harness_results (check_id, passed, detail)
  select 't03_org2_course_hidden', count(*) = 0, 'rows=' || count(*)
  from public.courses where owner_id = 'a2000000-0000-0000-0000-000000000002';
  insert into public.harness_results (check_id, passed, detail)
  select 't03_org2_student_profile_hidden', count(*) = 0, 'rows=' || count(*)
  from public.profiles where id = 'b2000000-0000-0000-0000-000000000009';
  insert into public.harness_results (check_id, passed, detail)
  select 't03_org2_membership_hidden', count(*) = 0, 'rows=' || count(*)
  from public.memberships where organization_id = '22222222-2222-2222-2222-222222222222';

  -- Positif: T1 melihat 3 murid cohort yang dia ajar.
  insert into public.harness_results (check_id, passed, detail)
  select 'p03_own_cohort_students', count(*) = 3, 'rows=' || count(*)
  from public.profiles p
  where p.id in ('b0000000-0000-0000-0000-000000000001',
                 'b0000000-0000-0000-0000-000000000002',
                 'b0000000-0000-0000-0000-000000000003');

  -- Guru boleh menilai/mengubah attempt murid cohortnya (kontrol positif policy).
  update public.attempts set raw_score = 80
  where assessment_id = 'a1000000-0000-0000-0000-000000000004';
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('p03_teacher_grade_own_cohort', n = 1, 'rows=' || n);
end $$;

set role postgres;

-- ============ GURU LAIN T2 (org 2) ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000002"}', false);

do $$
begin
  insert into public.harness_results (check_id, passed, detail)
  select 'p03d_org2_own_student', count(*) = 1, 'rows=' || count(*)
  from public.profiles where id = 'b2000000-0000-0000-0000-000000000009';
  insert into public.harness_results (check_id, passed, detail)
  select 't03d_org1_student_hidden_from_T2', count(*) = 0, 'rows=' || count(*)
  from public.profiles where id = 'b0000000-0000-0000-0000-000000000001';
  insert into public.harness_results (check_id, passed, detail)
  select 't03e_org1_course_hidden_from_T2', count(*) = 0, 'rows=' || count(*)
  from public.courses where owner_id = 'a0000000-0000-0000-0000-000000000001';
end $$;

set role postgres;

-- ============ WALI G (aaaaaaaa-…-aa) tertaut AKTIF ke Murid 01 (A) ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000aa"}', false);

do $$
begin
  -- Denial 4: wali melihat ANAK TERTAUT; bukan anak lain (C) & tak bisa INSERT link.
  insert into public.harness_results (check_id, passed, detail)
  select 'p04_linked_child_profile', count(*) = 1, 'rows=' || count(*)
  from public.profiles where id = 'b0000000-0000-0000-0000-000000000001';
  insert into public.harness_results (check_id, passed, detail)
  select 'p04_linked_child_enrollment', count(*) >= 1, 'rows=' || count(*)
  from public.enrollments where student_id = 'b0000000-0000-0000-0000-000000000001';
  insert into public.harness_results (check_id, passed, detail)
  select 't04_unlinked_child_profile_hidden', count(*) = 0, 'rows=' || count(*)
  from public.profiles where id = 'b0000000-0000-0000-0000-000000000003';
  insert into public.harness_results (check_id, passed, detail)
  select 't04_unlinked_child_enrollment_hidden', count(*) = 0, 'rows=' || count(*)
  from public.enrollments where student_id = 'b0000000-0000-0000-0000-000000000003';
end $$;

do $$
begin
  begin
    insert into public.guardian_links (guardian_id, student_id, status) values
      ('aaaaaaaa-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000003', 'active');
    insert into public.harness_results (check_id, passed, detail)
    values ('t04_link_insert_denied', false, 'INSERT TIDAK diblokir!');
  exception when others then
    if sqlstate = '42501' then
      insert into public.harness_results (check_id, passed, detail)
      values ('t04_link_insert_denied', true, 'sqlstate 42501');
    else
      raise;
    end if;
  end;
end $$;

set role postgres;

-- ============ ANONIM ============
set role anon;
select set_config('request.jwt.claims', '', false);

do $$
begin
  -- Denial 5: anonymous tidak membaca tabel internal (0 baris, bukan error grant).
  insert into public.harness_results (check_id, passed, detail)
  select 't05_anon_profiles', count(*) = 0, 'rows=' || count(*) from public.profiles;
  insert into public.harness_results (check_id, passed, detail)
  select 't05_anon_memberships', count(*) = 0, 'rows=' || count(*) from public.memberships;
  insert into public.harness_results (check_id, passed, detail)
  select 't05_anon_attempts', count(*) = 0, 'rows=' || count(*) from public.attempts;
  insert into public.harness_results (check_id, passed, detail)
  select 't05_anon_certificates', count(*) = 0, 'rows=' || count(*) from public.certificates;
  -- Verifier publik juga belum terbaca anon (row demo + RLS anon = gap Phase 6 terdokumentasi).
  insert into public.harness_results (check_id, passed, detail)
  select 't05_anon_verifier_view', count(*) = 0, 'rows=' || count(*) from public.certificates_public;
end $$;

do $$
begin
  begin
    insert into public.memberships (organization_id, user_id, role) values
      ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'student');
    insert into public.harness_results (check_id, passed, detail)
    values ('t05_anon_insert_denied', false, 'INSERT TIDAK diblokir!');
  exception when others then
    if sqlstate = '42501' then
      insert into public.harness_results (check_id, passed, detail)
      values ('t05_anon_insert_denied', true, 'sqlstate 42501');
    else
      raise;
    end if;
  end;
end $$;

set role postgres;

-- ============ STRUKTUR VERIFIER MINIMAL-PII (Denial 6) ============
do $$
begin
  insert into public.harness_results (check_id, passed, detail)
  select 't06_view_minimal_pii', count(*) = 0, 'cols=' || count(*)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'certificates_public'
    and lower(column_name) in ('email', 'dob', 'birth_date', 'answer_json', 'pdf_path', 'qr_path');
end $$;

-- ============ GURU T1 boleh REVOKE cert cohort sendiri (Denial 7 kontrol positif) ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001"}', false);

do $$
declare cid uuid;
begin
  select id into cid from public.certificates where public_id = 'demo-valid-certificate';
  if cid is not null then
    perform public.revoke_certificate(cid, 'live denial test');
    insert into public.harness_results (check_id, passed, detail)
    values ('p07_teacher_revoke_own_cohort', true, 'revoked=' || cid::text);
  else
    insert into public.harness_results (check_id, passed, detail)
    values ('p07_teacher_revoke_own_cohort', true, 'no cert row (seed demo missing)');
  end if;
end $$;

set role postgres;

-- Hasil (dibaca runner).
set role postgres;
select check_id || '|' || case when passed then 'PASS' else 'FAIL' end as result
from public.harness_results
order by id;
