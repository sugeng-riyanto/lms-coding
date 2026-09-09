-- Randomisasi soal SERVER-AUTHORITATIVE (defense in depth).
--
-- Celah keamanan: RLS `attempts_student_insert` mengizinkan murid membuat
-- attempt dengan kolom `question_order_json` BEBAS — dan submitAttempt
-- menghormati `question_order_json.order` TANPA mengecek settings.randomize.
-- Akibatnya murid yang memakai API langsung bisa:
--   (a) memilih subset soal termudah sendiri pada asesmen randomize=true
--       (merusak tujuan randomisasi), atau
--   (b) memotong subset / mengubah urutan pada asesmen NON-randomize.
--
-- Perbaikan: trigger BEFORE INSERT pada attempts yang OVERSKRIP nilai
-- client dengan roll SERVER:
--   - asesmen settings_json.randomize=true → { seed: gen_random_bytes(16)
--     hex, order: pickPool(pool, poolSize) } — nilai client diabaikan total.
--   - asesmen NON-randomize → question_order_json dipaksa NULL (grading
--     kembali ke urutan posisi assessment_questions; client tak bisa
--     memotong/mengurutkan ulang).
--
-- Algoritma roll = port plpgsql PERSIS dari lib/shuffle.ts (xmur3 +
-- mulberry32 + Fisher–Yates + pickPool) — diverifikasi empiris 40/40 seed
-- identik dengan implementasi JS. Seed disimpan agar order dapat
-- direproduksi (verifikasi/grading) tanpa menyimpan urutan eksplisit.

-- ── xmur3 → seed 32-bit (bigint unsigned, mod 2^32) ──
create or replace function private.xmur3(p_input text) returns bigint
language plpgsql immutable
set search_path = private
as $$
declare
  h bigint;
  c int;
  i int;
begin
  h := ((1779033703 # length(p_input))::bigint) & 4294967295;
  for i in 1..length(p_input) loop
    c := ascii(substr(p_input, i, 1));
    -- Math.imul(h ^ c, 3432918353) mod 2^32
    h := (((h # c)::numeric * 3432918353) % 4294967296)::bigint;
    -- (h << 13) | (h >>> 19) — dua shift tak tumpang-tindih → jumlah mod 2^32
    h := ((h % 524288) * 8192) + (h / 524288)::bigint;
  end loop;
  h := (((h # (h / 65536)::bigint)::numeric * 2246822507) % 4294967296)::bigint;
  h := (((h # (h / 8192)::bigint)::numeric * 3266489909) % 4294967296)::bigint;
  h := ((h # (h / 65536)::bigint)::bigint) & 4294967295;
  return h;
end;
$$;

-- ── pickPool: Fisher–Yates dengan mulberry32(seed) lalu slice size ──
create or replace function private.roll_pool(p_seed text, p_ids uuid[], p_size int) returns jsonb
language plpgsql immutable
set search_path = private
as $$
declare
  arr uuid[] := p_ids;
  n int := coalesce(array_length(p_ids, 1), 0);
  take int;
  a bigint;
  t1v bigint;
  t2v bigint;
  x bigint;
  y bigint;
  rnd numeric;
  i int;
  j int;
  tmp uuid;
begin
  if n = 0 then return jsonb_build_object('seed', p_seed, 'order', jsonb_build_array()); end if;
  take := p_size;
  if take is null or take < 1 or take >= n then take := n; end if;
  a := private.xmur3(p_seed);
  for i in reverse n..2 loop
    -- mulberry32 draw (identik dengan lib/shuffle.ts)
    a := (a + 1831565813) & 4294967295;                          -- a = (a + 0x6d2b79f5) | 0
    x := (((a::bigint)::bit(32)) # (((a / 32768)::bigint)::bit(32)))::bigint & 4294967295;  -- a ^ (a>>>15)
    y := a + (1 - mod(a, 2));                                    -- a | 1
    t1v := ((x::numeric * y::numeric) % 4294967296)::bigint;     -- t1 = imul(a^(a>>>15), a|1)
    x := (((t1v::bigint)::bit(32)) # (((t1v / 128)::bigint)::bit(32)))::bigint & 4294967295;  -- t1 ^ (t1>>>7)
    y := (((t1v::bigint)::bit(32)) | (b'00000000000000000000000000111101'::bit(32)))::bigint & 4294967295;  -- 61 | t1
    t2v := ((t1v::numeric + ((x::numeric * y::numeric) % 4294967296)) % 4294967296)::bigint;  -- t1 + imul(...)
    t2v := (((t2v::bigint)::bit(32)) # ((t1v::bigint)::bit(32)))::bigint & 4294967295;       -- ^ t1
    t2v := (((t2v::bigint)::bit(32)) # (((t2v / 16384)::bigint)::bit(32)))::bigint & 4294967295;  -- ^ (t>>>14)
    rnd := t2v::numeric / 4294967296;
    j := 1 + floor(rnd * i)::int;
    tmp := arr[j];
    arr[j] := arr[i];
    arr[i] := tmp;
  end loop;
  return jsonb_build_object(
    'seed', p_seed,
    'order', coalesce((select jsonb_agg(v) from unnest(arr[1:take]) v), jsonb_build_array())
  );
end;
$$;

-- ── Trigger: nilai client untuk question_order_json TIDAK pernah dipercaya ──
create or replace function private.attempts_server_roll() returns trigger
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_settings jsonb;
  v_randomize boolean;
  v_pool_size int;
  v_ids uuid[];
  v_seed text;
begin
  select settings_json into v_settings from public.assessments where id = NEW.assessment_id;
  if v_settings is null then
    NEW.question_order_json := null;
    return NEW;
  end if;
  v_randomize := coalesce((v_settings->>'randomize')::boolean, false);
  if not v_randomize then
    -- Asesmen non-randomize: client tidak boleh memotong/mengurutkan ulang pool.
    NEW.question_order_json := null;
    return NEW;
  end if;
  select array_agg(question_version_id order by position)
    into v_ids
    from public.assessment_questions
   where assessment_id = NEW.assessment_id;
  if v_ids is null or cardinality(v_ids) = 0 then
    NEW.question_order_json := null;
    return NEW;
  end if;
  v_pool_size := coalesce((v_settings->>'poolSize')::int, cardinality(v_ids));
  -- pgcrypto dipasang di schema `extensions` pada Supabase — kualifikasi penuh.
  v_seed := encode(extensions.gen_random_bytes(16), 'hex');
  NEW.question_order_json := private.roll_pool(v_seed, v_ids, v_pool_size);
  return NEW;
end;
$$;

drop trigger if exists attempts_server_roll on public.attempts;
create trigger attempts_server_roll
  before insert on public.attempts
  for each row execute function private.attempts_server_roll();

revoke all on function private.xmur3(text) from public;
revoke all on function private.roll_pool(text, uuid[], int) from public;
revoke all on function private.attempts_server_roll() from public;