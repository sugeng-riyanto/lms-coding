-- Verifikasi hasil RESTORE (runbook #5): RLS utuh + data pokok hadir + anon
-- tetap 0 baris pada tabel privat. Output baris `id|PASS|detail` / `id|FAIL|detail`
-- agar runner (mirip live-denial) menghitung PASS/FAIL.

select 'rr_rls_exposed' as id,
       case when count(*) = 0 then 'FAIL|semua exposed table wajib RLS' else 'PASS|RLS aktif' end as res
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false;

select 'rr_rows_org' as id,
       case when (select count(*) from public.organizations) >= 1 then 'PASS|organizations>=1'
            else 'FAIL|organizations kosong' end as res;
select 'rr_rows_profiles' as id,
       case when (select count(*) from public.profiles) >= 5 then 'PASS|profiles>=5'
            else 'FAIL|profiles<5' end as res;
select 'rr_rows_courses' as id,
       case when (select count(*) from public.courses) >= 2 then 'PASS|courses>=2'
            else 'FAIL|courses<2' end as res;
select 'rr_rows_enrollments' as id,
       case when (select count(*) from public.enrollments) >= 4 then 'PASS|enrollments>=4'
            else 'FAIL|enrollments<4' end as res;
select 'rr_rows_certificates' as id,
       case when (select count(*) from public.certificates) >= 2 then 'PASS|certificates>=2'
            else 'FAIL|certificates<2' end as res;
select 'rr_rows_levels' as id,
       case when (select count(*) from public.levels) >= 4 then 'PASS|levels>=4'
            else 'FAIL|levels<4' end as res;

-- Anonim tetap terkunci pasca-restore (deny 0 baris tabel privat).
set role anon;
select 'rr_anon_profiles_0' as id,
       case when (select count(*) from public.profiles) = 0 then 'PASS|anon 0 profil'
            else 'FAIL|anon melihat profil' end as res;
select 'rr_anon_certs_0' as id,
       case when (select count(*) from public.certificates) = 0 then 'PASS|anon 0 sertifikat'
            else 'FAIL|anon melihat sertifikat' end as res;
reset role;
