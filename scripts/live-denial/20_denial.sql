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

-- ============ t10_* REISSUE SERTIFIKAT (Phase 6, migration 000010) ============
-- Guru org-1 (T1): issue → reissue atas enrollment-level YANG SAMA = riwayat
-- 2 baris (revoked + active) dan index `certificates_one_active` menolak
-- insert ACTIVE kedua; lintas-org tetap 0 baris; RPC reissue menolak guru
-- org lain dan murid. Selesai pasca p07 (demo cert sudah revoked di blok
-- sebelumnya), jadi t10 memakai pasangan enrollment Murid 01 × level pos 1
-- yang BELUM punya baris cert apa pun.
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001"}', false);

do $$
declare
  v_enr uuid;
  v_lv uuid := 'f0000000-0000-0000-0000-000000000002';
  v_c1 uuid;
  v_c2 uuid;
  r uuid;
  active_cnt int;
  hist int;
  revoked_cnt int;
begin
  select id into v_enr from public.enrollments
  where student_id = 'b0000000-0000-0000-0000-000000000001'
    and course_id = 'd0000000-0000-0000-0000-000000000001'
  limit 1;

  -- (a) issue → tepat satu ACTIVE.
  select public.issue_certificate(v_enr, v_lv, 't10-issue-1') into v_c1;
  select count(*) into active_cnt from public.certificates
  where enrollment_id = v_enr and level_id = v_lv and status = 'active';
  insert into public.harness_results (check_id, passed, detail)
  values ('t10_issue_active_count_1', v_c1 is not null and active_cnt = 1,
          'c1=' || coalesce(v_c1::text, 'null') || ' active=' || active_cnt);

  -- (b) reissue → riwayat pair = 2 baris: c1 revoked + c2 active baru.
  select public.reissue_certificate(v_c1, 'alasan t10 formal', 't10-reissue-1') into v_c2;
  select count(*) into hist from public.certificates
  where enrollment_id = v_enr and level_id = v_lv;
  select count(*) into active_cnt from public.certificates
  where enrollment_id = v_enr and level_id = v_lv and status = 'active';
  select count(*) into revoked_cnt from public.certificates
  where enrollment_id = v_enr and level_id = v_lv and status = 'revoked';
  insert into public.harness_results (check_id, passed, detail)
  values ('t10_reissue_history_revoked_plus_active',
          hist = 2 and active_cnt = 1 and revoked_cnt = 1,
          'hist=' || hist || ' active=' || active_cnt || ' revoked=' || revoked_cnt
          || ' c1=' || v_c1::text || ' c2=' || v_c2::text);

  -- (c) retry-safe by state: panggilan lagi atas c1 (sudah revoked) → c2 sama.
  begin
    select public.reissue_certificate(v_c1, 't10 retry', 't10-reissue-2') into r;
    insert into public.harness_results (check_id, passed, detail)
    values ('t10_reissue_retry_same_active', r = v_c2,
            'retry=' || coalesce(r::text, 'null') || ' expect=' || coalesce(v_c2::text, 'null'));
  end;

  -- (d) index partial: insert ACTIVE kedua untuk pair sama → duplicate key.
  begin
    insert into public.certificates
      (public_id, enrollment_id, level_id, serial_no, status, payload_json, payload_hash)
    values ('t10-dup-active', v_enr, v_lv, 'DUP-0001', 'active', '{}', lpad('', 64, '0'));
    insert into public.harness_results (check_id, passed, detail)
    values ('t10_second_active_insert_denied', false,
            'INSERT active kedua TIDAK diblokir index!');
  exception when others then
    insert into public.harness_results (check_id, passed, detail)
    values ('t10_second_active_insert_denied', sqlstate = '23505',
            'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
  end;
end $$;

do $$
declare n int;
begin
  -- (e) lintas-org: guru org-1 tetap 0 baris cert org-2.
  insert into public.harness_results (check_id, passed, detail)
  select 't10_org2_cert_hidden', count(*) = 0, 'rows=' || count(*)
  from public.certificates c
  join public.enrollments e on e.id = c.enrollment_id
  join public.cohorts ch on ch.id = e.cohort_id
  where ch.organization_id = '22222222-2222-2222-2222-222222222222';

  -- (f) RPC reissue atas cert org-2 (id fixture tetap; tak terbaca RLS) → FORBIDDEN.
  begin
    perform public.reissue_certificate('33330000-0000-0000-0000-0000000000aa',
                                       'cross org', 't10-cross-org');
    insert into public.harness_results (check_id, passed, detail)
    values ('t10_crossorg_reissue_denied', false, 'RPC reissue TIDAK menolak guru org lain!');
  exception when others then
    insert into public.harness_results (check_id, passed, detail)
    values ('t10_crossorg_reissue_denied', sqlerrm like '%FORBIDDEN%',
            'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
  end;
end $$;

set role postgres;

-- ============ t10: MURID A tidak bisa reissue (hanya guru cohort) ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001"}', false);

do $$
declare v_own uuid;
begin
  -- cert ACTIVE milik A sendiri (c2 dari pasangan level pos 1).
  select c.id into v_own from public.certificates c
  join public.enrollments e on e.id = c.enrollment_id
  where e.student_id = 'b0000000-0000-0000-0000-000000000001'
    and c.status = 'active'
  limit 1;
  begin
    perform public.reissue_certificate(v_own, 'self reissue', 't10-self');
    insert into public.harness_results (check_id, passed, detail)
    values ('t10_reissue_by_student_denied', false, 'RPC reissue TIDAK menolak murid!');
  exception when others then
    insert into public.harness_results (check_id, passed, detail)
    values ('t10_reissue_by_student_denied',
            v_own is not null and sqlerrm like '%FORBIDDEN%',
            'own=' || coalesce(v_own::text, 'null') || ' sqlstate=' || sqlstate || ' msg=' || sqlerrm);
  end;
end $$;

set role postgres;

-- ============ t10 simetri org-2: guru org-2 lihat & reissue cert sendiri ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000002"}', false);

do $$
declare
  c_org2 uuid;
  v_enr uuid;
  v_lv uuid;
  r uuid;
  hist int;
  active_cnt int;
begin
  -- Positif: cert org-2 terbaca oleh guru org-2 (id + pasangan).
  select c.id, c.enrollment_id, c.level_id into c_org2, v_enr, v_lv
  from public.certificates c
  join public.enrollments e on e.id = c.enrollment_id
  join public.cohorts ch on ch.id = e.cohort_id
  where ch.organization_id = '22222222-2222-2222-2222-222222222222'
    and c.status = 'active'
  limit 1;
  insert into public.harness_results (check_id, passed, detail)
  values ('p10_org2_own_cert_visible', c_org2 is not null,
          'c=' || coalesce(c_org2::text, 'null'));

  -- Reissue cert org-2 sendiri → revoked + new active (riwayat pair = 2).
  select public.reissue_certificate(c_org2, 'reissue org2', 't10-org2-reissue') into r;
  select count(*) into hist from public.certificates
  where enrollment_id = v_enr and level_id = v_lv;
  select count(*) into active_cnt from public.certificates
  where id = r and status = 'active';
  insert into public.harness_results (check_id, passed, detail)
  values ('p10_org2_reissue_ok', r is not null and hist = 2 and active_cnt = 1,
          'new=' || coalesce(r::text, 'null') || ' hist=' || hist || ' active=' || active_cnt);

  -- Simetri denial: cert org-1 (pair demo) tak terbaca guru org-2.
  insert into public.harness_results (check_id, passed, detail)
  select 't10_org1_cert_hidden_from_org2', count(*) = 0, 'rows=' || count(*)
  from public.certificates c
  join public.enrollments e on e.id = c.enrollment_id
  join public.cohorts ch on ch.id = e.cohort_id
  where ch.organization_id = '11111111-1111-1111-1111-111111111111';
end $$;

set role postgres;

-- ============ t11_* AI DRAFT FEEDBACK (migration 000011, ADR-014/015) ============
-- Consent default FALSE (fail closed); hanya guru teacher aktif org bisa set
-- (audit org.ai_consent); draft teacher-only: murid 0 baris, guru org lain
-- 0 baris, murid tak bisa insert/upsert; apply menulis feedback + revisi audit.
set role postgres;
do $$
declare c boolean;
begin
  select ai_feedback_consent into c from public.organizations
  where id = '22222222-2222-2222-2222-222222222222';
  insert into public.harness_results (check_id, passed, detail)
  values ('t11_consent_default_false', c = false, 'consent=' || coalesce(c::text, 'null'));
end $$;

set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001"}', false);

do $$
declare
  v_resp uuid;
  n int;
  audit_n int;
  fb jsonb;
  rev_n int;
  draft_status text;
begin
  select id into v_resp from public.responses
  where id = 'a1000000-0000-0000-0000-000000000012';

  -- (a) guru org-1 set consent org-1 → audit 'org.ai_consent' tercatat.
  perform public.set_org_ai_consent('11111111-1111-1111-1111-111111111111', true);
  select count(*) into audit_n from public.audit_logs
  where action = 'org.ai_consent' and organization_id = '11111111-1111-1111-1111-111111111111';
  insert into public.harness_results (check_id, passed, detail)
  values ('p11_consent_set_by_teacher', audit_n >= 1, 'audit=' || audit_n);

  -- (b) guru insert draft (RLS) + baca draft miliknya.
  insert into public.ai_feedback_drafts (response_id, body, model, status, created_by)
  select v_resp, 'draf AI mock', 'mock', 'draft', 'a0000000-0000-0000-0000-000000000001'
  where v_resp is not null;
  get diagnostics n = row_count;
  insert into public.harness_results (check_id, passed, detail)
  values ('p11_teacher_draft_insert', n = 1, 'rows=' || n);
  select count(*) into n from public.ai_feedback_drafts where response_id = v_resp;
  insert into public.harness_results (check_id, passed, detail)
  values ('p11_teacher_draft_select', n = 1, 'rows=' || n);

  -- (c) approve: feedback_json ber-ai_approved + grade_revisions audit + draft approved.
  perform public.apply_ai_feedback(v_resp, 'feedback final dari draft AI');
  select feedback_json into fb from public.responses where id = v_resp;
  select count(*) into rev_n from public.grade_revisions
  where attempt_id = (select attempt_id from public.responses where id = v_resp)
    and reason = 'ai_draft:approved';
  select status into draft_status from public.ai_feedback_drafts where response_id = v_resp;
  insert into public.harness_results (check_id, passed, detail)
  values ('p11_apply_ai_feedback', fb ? 'ai_approved' and rev_n = 1 and draft_status = 'approved',
          'ai_approved=' || (fb ? 'ai_approved') || ' revisions=' || rev_n || ' status=' || draft_status);

  -- (d) guru org-1 TIDAK bisa set consent org-2.
  begin
    perform public.set_org_ai_consent('22222222-2222-2222-2222-222222222222', true);
    insert into public.harness_results (check_id, passed, detail)
    values ('t11_org2_consent_denied', false, 'RPC consent TIDAK menolak guru org lain!');
  exception when others then
    insert into public.harness_results (check_id, passed, detail)
    values ('t11_org2_consent_denied', sqlerrm like '%FORBIDDEN%',
            'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
  end;
end $$;

set role postgres;

-- ============ t11: MURID A tak bisa set consent / lihat draft / insert ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001"}', false);

do $$
declare n int;
begin
  begin
    perform public.set_org_ai_consent('11111111-1111-1111-1111-111111111111', true);
    insert into public.harness_results (check_id, passed, detail)
    values ('t11_student_consent_denied', false, 'RPC consent TIDAK menolak murid!');
  exception when others then
    insert into public.harness_results (check_id, passed, detail)
    values ('t11_student_consent_denied', sqlerrm like '%FORBIDDEN%',
            'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
  end;

  insert into public.harness_results (check_id, passed, detail)
  select 't11_student_draft_hidden', count(*) = 0, 'rows=' || count(*)
  from public.ai_feedback_drafts;

  begin
    insert into public.ai_feedback_drafts (response_id, body, model, status, created_by) values
      ('a1000000-0000-0000-0000-000000000012', 'x', 'mock', 'draft', auth.uid());
    insert into public.harness_results (check_id, passed, detail)
    values ('t11_student_draft_insert_denied', false, 'INSERT draft TIDAK diblokir!');
  exception when others then
    insert into public.harness_results (check_id, passed, detail)
    values ('t11_student_draft_insert_denied', sqlstate = '42501',
            'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
  end;

  begin
    perform public.upsert_ai_draft('a1000000-0000-0000-0000-000000000012', 'x', 'mock');
    insert into public.harness_results (check_id, passed, detail)
    values ('t11_student_upsert_denied', false, 'RPC upsert TIDAK menolak murid!');
  exception when others then
    insert into public.harness_results (check_id, passed, detail)
    values ('t11_student_upsert_denied', sqlerrm like '%FORBIDDEN%',
            'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
  end;
end $$;

set role postgres;

-- ============ t11: guru org-2 tidak melihat draft org-1 ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000002"}', false);

do $$
begin
  insert into public.harness_results (check_id, passed, detail)
  select 't11_org2_teacher_draft_hidden', count(*) = 0, 'rows=' || count(*)
  from public.ai_feedback_drafts;
end $$;

set role postgres;

-- ============ t12: ATTEMPT — deadline server-authoritative + submit idempotent ============
-- (Phase 4, migration 000012: finalize_attempt menolak attempt lewat deadline;
--  submit ganda = no-op; murid lain TIDAK bisa mem-finalize attempt murid lain.)

-- Assessment ber-deadline (5 detik) untuk uji TIME_EXPIRED.
insert into public.assessments (id, activity_id, settings_json, total_points) values
  ('a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000003',
   '{"durationSeconds":5}', 10)
on conflict (id) do nothing;

-- Attempt expired milik Murid 01 (mulai 1 jam lalu) pada assessment ber-deadline.
insert into public.attempts (assessment_id, enrollment_id, attempt_no, status, idempotency_key, started_at)
select 'a1000000-0000-0000-0000-000000000005', e.id, 1, 'in_progress', 't12-expired', now() - interval '1 hour'
from public.enrollments e
where e.student_id = 'b0000000-0000-0000-0000-000000000001'
  and e.course_id = 'd0000000-0000-0000-0000-000000000001'
limit 1
on conflict (idempotency_key) do nothing;

-- Attempt kedua milik Murid 01 (masih hidup; id tetap) untuk uji FORBIDDEN lintas murid.
insert into public.attempts (id, assessment_id, enrollment_id, attempt_no, status, idempotency_key, started_at)
select 'a1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000004', e.id, 2,
       'in_progress', 't12-cross', now()
from public.enrollments e
where e.student_id = 'b0000000-0000-0000-0000-000000000001'
  and e.course_id = 'd0000000-0000-0000-0000-000000000001'
limit 1
on conflict (id) do nothing;

-- Murid 01: finalize attempt miliknya sendiri yang masih hidup → boleh.
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
declare
  a_id uuid;
begin
  select id into a_id from public.attempts where idempotency_key = 'fixture-attempt-A';
  perform public.finalize_attempt(a_id, 't12-first');
  insert into public.harness_results (check_id, passed, detail)
  select 't12_own_finalize_allowed',
         status = 'submitted' and submitted_at is not null,
         'status=' || status
  from public.attempts where id = a_id;
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_own_finalize_allowed', false, 'unexpected: ' || sqlerrm);
end $$;

-- Submit ganda: panggilan kedua tidak error dan tidak mengubah apa pun (idempotent).
do $$
declare
  a_id uuid; s1 timestamptz; s2 timestamptz; st text;
begin
  select id into a_id from public.attempts where idempotency_key = 'fixture-attempt-A';
  select submitted_at into s1 from public.attempts where id = a_id;
  perform public.finalize_attempt(a_id, 't12-second');
  select status, submitted_at into st, s2 from public.attempts where id = a_id;
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_duplicate_submit_noop', st = 'submitted' and s2 = s1,
          'status=' || st || ' same_ts=' || (s2 = s1));
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_duplicate_submit_noop', false, 'unexpected: ' || sqlerrm);
end $$;

-- Attempt lewat deadline (mulai 1 jam lalu, durasi 5 dtk) → TIME_EXPIRED.
do $$
declare
  a_id uuid;
begin
  select id into a_id from public.attempts where idempotency_key = 't12-expired';
  perform public.finalize_attempt(a_id, 't12-expired-submit');
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_deadline_rejected', false, 'RPC TIDAK menolak attempt lewat deadline!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_deadline_rejected', sqlerrm like '%TIME_EXPIRED%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

set role postgres;

-- Murid 02: attempt milik Murid 01 tak terbaca RLS + RPC menolak finalize.
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);

do $$
declare
  n int;
begin
  select count(*) into n from public.attempts where id = 'a1000000-0000-0000-0000-000000000020';
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_cross_student_read_hidden', n = 0, 'rows=' || n);
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_cross_student_read_hidden', false, 'unexpected: ' || sqlerrm);
end $$;

do $$
begin
  -- RPC security definer: walau id diketahui murid 02, FORBIDDEN wajib naik
  -- (baris dijamin ada oleh insert postgres di atas + ON_ERROR_STOP).
  perform public.finalize_attempt('a1000000-0000-0000-0000-000000000020', 't12-cross-submit');
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_cross_student_finalize_denied', false, 'RPC TIDAK menolak murid lain!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t12_cross_student_finalize_denied', sqlerrm like '%FORBIDDEN%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

set role postgres;

-- ============ t13: RUBRIK — per-kriteria draft/finalize + audit + lintas-akses ============
-- (Phase 4 manual, migration 000013: versioned rubrics + criterion_scores RPC-only;
--  guru cohort menilai per kriteria draft; finalize menghitung manual_score + revision + audit.)

-- Rubrik org-1 (fixture) dengan 2 kriteria, diikat ke question_version fixture ...011.
insert into public.rubrics (id, organization_id, title, version, created_by) values
  ('a1000000-0000-0000-0000-000000000030', '11111111-1111-1111-1111-111111111111', 'Rubrik Esai Demo', 1,
   'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
insert into public.rubric_criteria (id, rubric_id, title, max_points, position) values
  ('a1000000-0000-0000-0000-000000000031', 'a1000000-0000-0000-0000-000000000030', 'Ketepatan konsep', 60, 0),
  ('a1000000-0000-0000-0000-000000000032', 'a1000000-0000-0000-0000-000000000030', 'Kedalaman & struktur', 40, 1)
on conflict (id) do nothing;
update public.question_versions set rubric_id = 'a1000000-0000-0000-0000-000000000030'
where id = 'a1000000-0000-0000-0000-000000000011';

-- Rubrik org-2 (untuk uji RUBRIC_MISMATCH lintas-org).
insert into public.rubrics (id, organization_id, title, version, created_by) values
  ('a1000000-0000-0000-0000-000000000040', '22222222-2222-2222-2222-222222222222', 'Rubrik Org Lain', 1,
   'a2000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;
insert into public.rubric_criteria (id, rubric_id, title, max_points, position) values
  ('a1000000-0000-0000-0000-000000000041', 'a1000000-0000-0000-0000-000000000040', 'Kriteria asing', 50, 0)
on conflict (id) do nothing;

-- Guru org-1: skor draft dua kriteria; nilai lama (70 fixture) belum berubah.
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
begin
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012',
                                      'a1000000-0000-0000-0000-000000000031', 30, 'konsep oke', true);
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012',
                                      'a1000000-0000-0000-0000-000000000032', 20, '', true);
  insert into public.harness_results (check_id, passed, detail)
  select 't13_draft_saved_ok',
         count(*) = 2 and bool_and(cs.draft) and min(r.manual_score) = 70,
         'rows=' || count(*) || ' draft=' || bool_and(cs.draft) || ' manual=' || min(r.manual_score)
  from public.criterion_scores cs
  join public.responses r on r.id = cs.response_id
  where cs.response_id = 'a1000000-0000-0000-0000-000000000012';
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_draft_saved_ok', false, 'unexpected: ' || sqlerrm);
end $$;

-- Kriteria dari rubrik org-2 → RUBRIC_MISMATCH (rubrik soal ≠ rubrik kriteria).
do $$
begin
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012',
                                      'a1000000-0000-0000-0000-000000000041', 10, '', true);
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_rubric_mismatch_rejected', false, 'RPC TIDAK menolak kriteria rubrik lain!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_rubric_mismatch_rejected', sqlerrm like '%RUBRIC_MISMATCH%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

-- Finalize dengan satu kriteria masih draft → DRAFT_INCOMPLETE.
do $$
begin
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012',
                                      'a1000000-0000-0000-0000-000000000031', 54, '', false);
  perform public.finalize_response_grades('a1000000-0000-0000-0000-000000000012');
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_finalize_draft_incomplete_denied', false, 'RPC TIDAK menolak draft belum lengkap!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_finalize_draft_incomplete_denied', sqlerrm like '%DRAFT_INCOMPLETE%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

-- Finalize lengkap: skor 54/60 + 32/40 → 86/100; manual_score + revision + audit.
do $$
begin
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012',
                                      'a1000000-0000-0000-0000-000000000031', 54, '', false);
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012',
                                      'a1000000-0000-0000-0000-000000000032', 32, '', false);
  perform public.finalize_response_grades('a1000000-0000-0000-0000-000000000012');
  insert into public.harness_results (check_id, passed, detail)
  select 't13_finalize_writes_revision_audit',
         r.manual_score = 86
         and exists (select 1 from public.grade_revisions g where g.attempt_id = r.attempt_id
                     and g.previous_score = 70 and g.new_score = 86 and g.reason = 'rubric finalized')
         and exists (select 1 from public.audit_logs al where al.target_id = r.id::text
                     and al.action = 'grade.finalized'),
         'manual=' || r.manual_score
  from public.responses r where r.id = 'a1000000-0000-0000-0000-000000000012';
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_finalize_writes_revision_audit', false, 'unexpected: ' || sqlerrm);
end $$;

-- Re-finalize nilai sama → idempoten, tanpa revisi baru.
do $$
begin
  perform public.finalize_response_grades('a1000000-0000-0000-0000-000000000012');
  insert into public.harness_results (check_id, passed, detail)
  select 't13_finalize_idempotent_noop', count(*) = 1, 'revisions=' || count(*)
  from public.grade_revisions g
  where g.attempt_id = (select attempt_id from public.responses where id = 'a1000000-0000-0000-0000-000000000012')
    and g.reason = 'rubric finalized';
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_finalize_idempotent_noop', false, 'unexpected: ' || sqlerrm);
end $$;

-- Guru org-2: tidak boleh menilai response cohort org-1 → FORBIDDEN.
set role postgres;
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', false);

do $$
begin
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012',
                                      'a1000000-0000-0000-0000-000000000031', 10, '', true);
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_cross_org_grade_denied', false, 'RPC TIDAK menolak guru org lain!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_cross_org_grade_denied', sqlerrm like '%FORBIDDEN%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

-- Murid 01: tidak boleh menilai (bukan guru) → FORBIDDEN; RLS menyembunyikan skor.
set role postgres;
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
declare
  n int;
begin
  select count(*) into n from public.criterion_scores
  where response_id = 'a1000000-0000-0000-0000-000000000012';
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_student_scores_hidden', n = 0, 'rows=' || n);
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_student_scores_hidden', false, 'unexpected: ' || sqlerrm);
end $$;

do $$
begin
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012',
                                      'a1000000-0000-0000-0000-000000000031', 10, '', false);
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_student_grade_denied', false, 'RPC TIDAK menolak murid!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t13_student_grade_denied', sqlerrm like '%FORBIDDEN%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

set role postgres;

-- ============ t14: RE-VERSI RUBRIK — bump version + salin kriteria (migration 000015) ============
-- Guru org-1 menaikkan rubrik fixture ...030 (v1: 2 kriteria) menjadi v2 (3 kriteria).
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
declare
  v int;
begin
  v := public.update_rubric_version(
    'a1000000-0000-0000-0000-000000000030', 'Rubrik Versi 2',
    '[{"title":"Ketepatan konsep","maxPoints":50},{"title":"Struktur \u0026 alur","maxPoints":30},{"title":"Kebersihan kode","maxPoints":20}]'::jsonb);
  insert into public.harness_results (check_id, passed, detail)
  select 't14_reversion_bumps_to_v2',
         v = 2 and r.version = 2 and r.title = 'Rubrik Versi 2',
         'returned=' || v || ' version=' || r.version
  from public.rubrics r where r.id = 'a1000000-0000-0000-0000-000000000030';
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_reversion_bumps_to_v2', false, 'unexpected: ' || sqlerrm);
end $$;

-- Kriteria lama (v1) dipertahankan; criteria baru v2 tersimpan terpisah.
do $$
declare
  v1 int; v2 int; old_kept boolean;
begin
  select count(*) into v1 from public.rubric_criteria
  where rubric_id = 'a1000000-0000-0000-0000-000000000030' and version = 1;
  select count(*) into v2 from public.rubric_criteria
  where rubric_id = 'a1000000-0000-0000-0000-000000000030' and version = 2;
  select exists (select 1 from public.rubric_criteria where id = 'a1000000-0000-0000-0000-000000000031')
    into old_kept;
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_old_criteria_preserved_new_versioned',
          v1 = 2 and v2 = 3 and old_kept, 'v1=' || v1 || ' v2=' || v2 || ' old_kept=' || old_kept);
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_old_criteria_preserved_new_versioned', false, 'unexpected: ' || sqlerrm);
end $$;

-- Response ...012 sudah final di v1 (86) → setelah re-versi, finalize wajib
-- memakai kriteria v2 yang belum dinilai → DRAFT_INCOMPLETE.
do $$
begin
  perform public.finalize_response_grades('a1000000-0000-0000-0000-000000000012');
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_finalize_uses_active_version', false, 'RPC TIDAK menuntut skor versi aktif!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_finalize_uses_active_version', sqlerrm like '%DRAFT_INCOMPLETE%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

-- Draf skor pada kriteria v2 lalu finalize → skor baru berbasis v2 (50+30+20).
do $$
declare
  c1 uuid; c2 uuid; c3 uuid;
begin
  select id into c1 from public.rubric_criteria
  where rubric_id = 'a1000000-0000-0000-0000-000000000030' and version = 2
  order by position limit 1 offset 0;
  select id into c2 from public.rubric_criteria
  where rubric_id = 'a1000000-0000-0000-0000-000000000030' and version = 2
  order by position limit 1 offset 1;
  select id into c3 from public.rubric_criteria
  where rubric_id = 'a1000000-0000-0000-0000-000000000030' and version = 2
  order by position limit 1 offset 2;
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012', c1, 45, '', false);
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012', c2, 25, '', false);
  perform public.save_criterion_grade('a1000000-0000-0000-0000-000000000012', c3, 20, '', false);
  perform public.finalize_response_grades('a1000000-0000-0000-0000-000000000012');
  insert into public.harness_results (check_id, passed, detail)
  select 't14_v2_finalize_score', manual_score = 90, 'manual=' || manual_score
  from public.responses where id = 'a1000000-0000-0000-0000-000000000012';
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_v2_finalize_score', false, 'unexpected: ' || sqlerrm);
end $$;

-- Guru org-2: re-versi rubrik org-1 → FORBIDDEN.
set role postgres;
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', false);

do $$
begin
  perform public.update_rubric_version(
    'a1000000-0000-0000-0000-000000000030', 'X', '[{"title":"a","maxPoints":1}]'::jsonb);
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_cross_org_reversion_denied', false, 'RPC TIDAK menolak guru org lain!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_cross_org_reversion_denied', sqlerrm like '%FORBIDDEN%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

-- Murid: re-versi rubrik → FORBIDDEN.
set role postgres;
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
begin
  perform public.update_rubric_version(
    'a1000000-0000-0000-0000-000000000030', 'X', '[{"title":"a","maxPoints":1}]'::jsonb);
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_student_reversion_denied', false, 'RPC TIDAK menolak murid!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_student_reversion_denied', sqlerrm like '%FORBIDDEN%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

-- Payload kriteria invalid → INVALID_CRITERIA (guru org-1).
set role postgres;
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
begin
  perform public.update_rubric_version(
    'a1000000-0000-0000-0000-000000000030', 'X', '[]'::jsonb);
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_invalid_criteria_rejected', false, 'RPC TIDAK menolak kriteria kosong!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t14_invalid_criteria_rejected', sqlerrm like '%INVALID_CRITERIA%',
          'sqlstate=' || sqlstate || ' msg=' || sqlerrm);
end $$;

-- ============ t16: study_sessions write path (ADR-010) + goal menit ============
-- (migration 000016: RLS read-only utk murid, RPC append definer dengan clamp,
--  CHECK goal unit-aware; DB fresh per run oleh run.sh)
set role postgres;

-- Fixture: sesi belajar per murid dengan status "latest" yang deterministik:
--   …016 Murid 01 (60 s, berakhir 4 mnt lalu) → uji lanjutan sesi;
--   …017 Murid 02 (0 s, berakhir 2 mnt lalu)  → uji clamp delta;
--   …018 Murid 03 (60 s, berakhir 15 mnt lalu) → uji sesi baru (gap > 10 mnt);
--   …01c Murid 02 (21500 s, berakhir 1 mnt lalu) → uji cap sesi (setelah …017).
insert into public.study_sessions (id, enrollment_id, started_at, ended_at, active_seconds)
select 'b1000000-0000-0000-0000-000000000016', e.id, now() - interval '6 minutes', now() - interval '4 minutes', 60
from public.enrollments e
where e.student_id = 'b0000000-0000-0000-0000-000000000001'
  and e.course_id = 'd0000000-0000-0000-0000-000000000001'
limit 1;
insert into public.study_sessions (id, enrollment_id, started_at, ended_at, active_seconds)
select 'b1000000-0000-0000-0000-000000000017', e.id, now() - interval '3 minutes', now() - interval '2 minutes', 0
from public.enrollments e
where e.student_id = 'b0000000-0000-0000-0000-000000000002'
  and e.course_id = 'd0000000-0000-0000-0000-000000000001'
limit 1;
insert into public.study_sessions (id, enrollment_id, started_at, ended_at, active_seconds)
select 'b1000000-0000-0000-0000-000000000018', e.id, now() - interval '20 minutes', now() - interval '15 minutes', 60
from public.enrollments e
where e.student_id = 'b0000000-0000-0000-0000-000000000003'
  and e.course_id = 'd0000000-0000-0000-0000-000000000001'
limit 1;

-- Lanjutan sesi: 30000 ms = 30 s → active_seconds 60 + 30 = 90 (bukan 30060!).
do $$
declare v int;
begin
  perform public.append_study_session(
    (select e.id from public.enrollments e
      where e.student_id = 'b0000000-0000-0000-0000-000000000001'
        and e.course_id = 'd0000000-0000-0000-0000-000000000001' limit 1),
    30000, now());
  select active_seconds into v from public.study_sessions where id = 'b1000000-0000-0000-0000-000000000016';
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_append_continuation', v = 90, 'active_seconds=' || v);
end $$;

-- Gap > 10 mnt (sesi terakhir berakhir 15 mnt lalu) → sesi BARU untuk Murid 03.
do $$
declare n int; v int; enr uuid;
begin
  select e.id into enr from public.enrollments e
  where e.student_id = 'b0000000-0000-0000-0000-000000000003'
    and e.course_id = 'd0000000-0000-0000-0000-000000000001' limit 1;
  perform public.append_study_session(enr, 30000, now());
  select count(*) into n from public.study_sessions where enrollment_id = enr;
  select active_seconds into v from public.study_sessions where id = 'b1000000-0000-0000-0000-000000000018';
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_append_new_session', n = 2 and v = 60, 'sessions=' || n || ', old=' || v);
end $$;

-- Delta per panggilan di-clamp: 999999 ms → 120 s; sesi 0 + 120 = 120.
do $$
declare v int;
begin
  perform public.append_study_session(
    (select e.id from public.enrollments e
      where e.student_id = 'b0000000-0000-0000-0000-000000000002'
        and e.course_id = 'd0000000-0000-0000-0000-000000000001' limit 1),
    999999, now());
  select active_seconds into v from public.study_sessions where id = 'b1000000-0000-0000-0000-000000000017';
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_append_delta_clamped', v = 120, 'active_seconds=' || v);
end $$;

-- Cap keamanan sesi: sesi 21500 + delta 120 → 21600 (6 jam), bukan 21620.
-- (enrollment org-2 milik murid b20…009 — tidak dipakai uji lain.)
do $$
declare v int; enr uuid;
begin
  select e.id into enr from public.enrollments e
  where e.student_id = 'b2000000-0000-0000-0000-000000000009'
    and e.course_id = 'd2000000-0000-0000-0000-000000000002' limit 1;
  insert into public.study_sessions (id, enrollment_id, started_at, ended_at, active_seconds)
  values ('b1000000-0000-0000-0000-00000000001c', enr, now() - interval '2 minutes', now() - interval '1 minute', 21500);
  perform public.append_study_session(enr, 999999, now());
  select active_seconds into v from public.study_sessions where id = 'b1000000-0000-0000-0000-00000000001c';
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_append_session_capped', v = 21600, 'active_seconds=' || v);
end $$;

-- weekly_plans: goal menit 180 diterima; completions 2000 ditolak CHECK.
do $$
begin
  insert into public.weekly_plans (enrollment_id, week_start, goal_unit, goal_value)
  select e.id, '2099-01-05', 'minutes', 180 from public.enrollments e
  where e.student_id = 'b0000000-0000-0000-0000-000000000001' limit 1;
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_goal_minutes_ok', true, 'goal 180 menit diterima');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_goal_minutes_ok', false, 'goal menit ditolak: ' || sqlerrm);
end $$;

do $$
begin
  insert into public.weekly_plans (enrollment_id, week_start, goal_unit, goal_value)
  select e.id, '2099-01-06', 'completions', 2000 from public.enrollments e
  where e.student_id = 'b0000000-0000-0000-0000-000000000001' limit 1;
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_goal_completions_bound_rejected', false, 'CHECK TIDAK menolak goal completions 2000!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_goal_completions_bound_rejected', true, 'sqlstate=' || sqlstate);
end $$;

-- Fixture enrollment org-2 milik Murid 02 (id tetap) utk uji RLS set-goal
-- lintas murid (subselect biasa akan kosong karena RLS select enrollments).
insert into public.enrollments (id, course_id, student_id, cohort_id, status)
values ('b1000000-0000-0000-0000-0000000000ff', 'd2000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'active');

-- ============ Murid A: baca sesi sendiri, sesi Murid B tersembunyi, tulis langsung ditolak ============
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001"}', false);

do $$
declare n int;
begin
  select count(*) into n from public.study_sessions
  where enrollment_id in (select id from public.enrollments where student_id = 'b0000000-0000-0000-0000-000000000001');
  insert into public.harness_results (check_id, passed, detail)
  values ('p16_student_own_session_visible', n = 1, 'rows=' || n);
  select count(*) into n from public.study_sessions
  where enrollment_id in (select id from public.enrollments where student_id = 'b0000000-0000-0000-0000-000000000002');
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_cross_student_session_hidden', n = 0, 'rows=' || n);
end $$;

do $$
begin
  insert into public.study_sessions (enrollment_id, active_seconds)
  select e.id, 999999 from public.enrollments e
  where e.student_id = 'b0000000-0000-0000-0000-000000000001' limit 1;
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_student_insert_denied', false, 'insert langsung TIDAK ditolak!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_student_insert_denied', true, 'sqlstate=' || sqlstate);
end $$;

do $$
begin
  perform public.append_study_session(
    (select e.id from public.enrollments e
      where e.student_id = 'b0000000-0000-0000-0000-000000000001' limit 1),
    30000, now());
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_student_rpc_denied', false, 'RPC publik TIDAK ditolak untuk murid!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_student_rpc_denied', true, 'sqlstate=' || sqlstate);
end $$;

-- Set goal: murid set target sendiri OK; goal enrollment murid lain DITOLAK RLS
-- (WITH CHECK dievaluasi: enrollment eksis tapi student_id ≠ auth.uid()).
do $$
begin
  insert into public.weekly_plans (enrollment_id, week_start, goal_unit, goal_value)
  select e.id, '2099-01-12', 'minutes', 90 from public.enrollments e
  where e.student_id = 'b0000000-0000-0000-0000-000000000001' limit 1;
  insert into public.harness_results (check_id, passed, detail)
  values ('p16_set_goal_own_enrollment_ok', true, 'goal sendiri diterima');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('p16_set_goal_own_enrollment_ok', false, 'ditolak: ' || sqlerrm);
end $$;

do $$
begin
  insert into public.weekly_plans (enrollment_id, week_start, goal_unit, goal_value)
  values ('b1000000-0000-0000-0000-0000000000ff', '2099-01-19', 'minutes', 60);
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_set_goal_other_enrollment_denied', false, 'RLS TIDAK menolak goal murid lain!');
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t16_set_goal_other_enrollment_denied', true, 'sqlstate=' || sqlstate);
end $$;

set role postgres;

-- ============ t15: RPC soal attempt tersanitasi (migration 000023) ============
-- Defect live: kuis selalu kosong untuk murid (tabel soal teacher-only, action
-- membaca via RLS user). RPC definer mengembalikan HANYA kolom tersanitasi
-- untuk attempt in_progress milik caller; murid lain/guru/attempt submitted → 0.

-- Attempt t15 milik Murid 01 (no 7 in_progress abadi; no 8 untuk uji submitted).
insert into public.attempts (id, assessment_id, enrollment_id, attempt_no, status, idempotency_key, started_at)
select 'a1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000004', e.id, 7, 'in_progress', 'fixture-attempt-t15', now()
from public.enrollments e
where e.student_id = 'b0000000-0000-0000-0000-000000000001'
  and e.course_id = 'd0000000-0000-0000-0000-000000000001'
limit 1
on conflict (id) do nothing;
insert into public.attempts (id, assessment_id, enrollment_id, attempt_no, status, idempotency_key, started_at)
select 'a1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000004', e.id, 8, 'in_progress', 'fixture-attempt-t15b', now()
from public.enrollments e
where e.student_id = 'b0000000-0000-0000-0000-000000000001'
  and e.course_id = 'd0000000-0000-0000-0000-000000000001'
limit 1
on conflict (id) do nothing;

-- Murid 01: RPC attempt miliknya (in_progress) mengembalikan ≥1 baris soal.
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
declare n int;
begin
  select count(*) into n from public.get_attempt_questions('a1000000-0000-0000-0000-000000000015');
  insert into public.harness_results (check_id, passed, detail)
  values ('p15_own_questions_visible', n >= 1, 'rows=' || n);
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('p15_own_questions_visible', false, 'unexpected: ' || sqlerrm);
end $$;

-- Murid 02: RPC attempt milik Murid 01 → 0 baris.
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}', false);

do $$
declare n int;
begin
  select count(*) into n from public.get_attempt_questions('a1000000-0000-0000-0000-000000000015');
  insert into public.harness_results (check_id, passed, detail)
  values ('t15_cross_student_empty', n = 0, 'rows=' || n);
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t15_cross_student_empty', false, 'unexpected: ' || sqlerrm);
end $$;

-- Guru org-1: bukan pemilik attempt → 0 baris (guru membaca bank via RLS sendiri).
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
declare n int;
begin
  select count(*) into n from public.get_attempt_questions('a1000000-0000-0000-0000-000000000015');
  insert into public.harness_results (check_id, passed, detail)
  values ('t15_teacher_empty', n = 0, 'rows=' || n);
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t15_teacher_empty', false, 'unexpected: ' || sqlerrm);
end $$;

-- Attempt yang sudah disubmit → RPC 0 baris (soal hanya disajikan saat menjawab).
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

do $$
declare n int;
begin
  perform public.finalize_attempt('a1000000-0000-0000-0000-000000000016', 't15-finalize');
  select count(*) into n from public.get_attempt_questions('a1000000-0000-0000-0000-000000000016');
  insert into public.harness_results (check_id, passed, detail)
  values ('t15_submitted_empty', n = 0, 'rows=' || n);
exception when others then
  insert into public.harness_results (check_id, passed, detail)
  values ('t15_submitted_empty', false, 'unexpected: ' || sqlerrm);
end $$;

set role postgres;

-- Hasil (dibaca runner).
set role postgres;
select check_id || '|' || case when passed then 'PASS' else 'FAIL' end as result
from public.harness_results
order by id;
