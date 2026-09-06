-- LMS pembelajaran coding: jenis aktivitas baru untuk konten media & kode.
--   code_board    — blok kode berbahasa (salinan satu-klik, syntax-aware front-end)
--   embed_youtube — video YouTube ter-embed (iframe youtube-nocookie, id di-parse)
--   embed_pdf     — dokumen PDF ter-embed (iframe)
--   embed_audio   — audio ter-embed (<audio controls>, https)
--   embed_file    — berkas pendukung (unduhan; https, tanpa eksekusi)
-- Rendering menyaring field: hanya url/code/language/name/transcript yang dibaca,
-- dan URL dibatasi http(s) (host YouTube di-allowlist). Tidak ada HTML arbitrer.

alter table public.activities drop constraint activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in (
    'article','video_link','resource','reflection','quiz',
    'assignment_upload','roblox_challenge',
    'code_board','embed_youtube','embed_pdf','embed_audio','embed_file'
  ));