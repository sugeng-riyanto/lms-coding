-- 000019: Public verifier RPC (minimal PII) — membuat /verify/{publicId} berfungsi
-- terhadap DB hidup tanpa melonggarkan RLS.
--
-- Latar (defect yang ditemukan saat smoke flow mock-anchor):
--   `certificates_public` adalah security_invoker (000000) dan TIDAK ada policy
--   anon pada tabel sumbernya (certificates/enrollments/profiles/courses/levels).
--   Akibatnya anon membaca 0 baris dari view (live-denial t05_anon_verifier_view
--   sengaja mengunci), sehingga halaman verifikasi publik hanya pernah menampilkan
--   fallback demo — tidak pernah data nyata dari DB hidup.
--
-- Solusi yang menjaga postur keamanan:
--   - View mentah TETAP security_invoker (anon tetap 0 baris → t05 berlaku, defense
--     in depth: view pun tidak bisa dibaca anon).
--   - Satu-satunya permukaan anon adalah RPC kurasi `get_public_certificate`:
--     security definer, memvalidasi format public_id, mengembalikan PERSIS kolom
--     whitelist (tanpa email, jawaban, nilai, storage path), dan di-revoke dari
--     PUBLIC + grant khusus anon/authenticated.

create or replace function public.get_public_certificate(p_public_id text)
returns jsonb
language plpgsql security definer set search_path = private, public, pg_temp
as $$
declare
  v_row record;
begin
  -- Validasi format sebelum query apa pun (hanya [a-z0-9-], maks 80).
  if p_public_id is null
     or length(p_public_id) > 80
     or p_public_id !~ '^[a-z0-9-]+$' then
    return null;
  end if;

  select
    c.status,
    p.display_name,
    co.title as course_title,
    l.title as level_title,
    c.issued_at,
    c.serial_no,
    c.payload_hash,
    (c.chain_anchor_id is not null) as chain_anchored,
    ca.status as chain_anchor_status
  into v_row
  from public.certificates c
  join public.enrollments e on e.id = c.enrollment_id
  join public.profiles p on p.id = e.student_id
  join public.courses co on co.id = e.course_id
  join public.levels l on l.id = c.level_id
  left join public.chain_anchors ca on ca.id = c.chain_anchor_id
  where c.public_id = p_public_id
    and c.status in ('active', 'revoked')
  limit 1;

  if v_row is null then
    return null;
  end if;

  return jsonb_build_object(
    'status', v_row.status,
    'displayName', v_row.display_name,
    'courseTitle', v_row.course_title,
    'levelTitle', v_row.level_title,
    'issuedAt', v_row.issued_at,
    'serialNo', v_row.serial_no,
    'payloadHash', v_row.payload_hash,
    'chainAnchored', v_row.chain_anchored,
    'chainAnchorStatus', v_row.chain_anchor_status
  );
end;
$$;

revoke all on function public.get_public_certificate(text) from public;
grant execute on function public.get_public_certificate(text) to anon, authenticated;