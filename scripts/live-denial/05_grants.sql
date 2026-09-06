-- Tiruan default privileges Supabase: anon & authenticated boleh MEMBACA tabel
-- public (policies yang memutuskan), authenticated boleh menulis, anon menulis
-- TIDAK. Tanpa grant ini "denied" bisa berasal dari kurangnya privilege, bukan
-- RLS — hasil tes jadi tidak valid.

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- storage.objects: murid/guru menulis folder milik/cohort-nya (diuji denial 8).
grant select, insert, update on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
