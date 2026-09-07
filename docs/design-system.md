# Design System — LMS Coding School (mini, 1 halaman)

Tujuan visual: **modern, depth halus (3D lembut), mikro-animasi hover — tetapi
tetap profesional dan elegant.** Seluruh token hidup di `app/globals.css`
(single source). Jangan hardcode bayangan/gradien baru di komponen — pakai
token di bawah.

## 1. Tokens elevation

| Token | Cahaya | Gelap | Pakai untuk |
| --- | --- | --- | --- |
| `--ambient` | radial blue/violet tipis | radial lebih terasa | latar `body` (glow lembut) |
| `--shadow-soft` | lapis halus | hitam pekat | permukaan diam: kartu, input, chip |
| `--shadow-lift` | 3 lapis dalam | gelap dalam | kartu terangkat / drawer / modal |
| `--glow-btn` | inner-highlight + glow biru | glow biru pekat | tombol primer/gradien & monogram |

Pola umum: kartu diam memakai `shadow-[var(--shadow-soft)]`; saat interaktif
tambahkan kelas `.card-lift` (hover otomatis `translateY(-3px)` +
`shadow-[var(--shadow-lift)]`).

## 2. Kelas `.card-lift`

```html
<div class="card-lift rounded-2xl border bg-white shadow-[var(--shadow-soft)] dark:bg-slate-900">
  <!-- isi kartu -->
</div>
```

Aturan pakai:
- Tambahkan pada **kartu interaktif** (StatCard, level map, bulk card, embed).
- JANGAN pada elemen non-interaktif besar (mis. wadah tabel) atau saat hover
  mengganggu baca (embed PDF/YouTube tetap boleh — lift-nya sangat halus).
- Jangan menumpuk `hover:translate-*` sendiri pada elemen ber-`.card-lift`
  (transform akan konflik dengan aturan `:hover` kelas).
- Semua gerak otomatis non-aktif saat `prefers-reduced-motion: reduce`.

## 3. Aturan gradien

- **Aksen default:** `from-blue-600 to-indigo-600` — garis atas kartu, pill nav
  aktif, CTA primer, tombol template/unduh, chip bahasa, monogram.
- **Tombol CTA:** sertakan `shadow-[var(--glow-btn)]` + `transition hover:from-…
  hover:to-…` (shade lebih tua) dan `disabled:opacity-60`.
- **Aksen tone StatCard** (kartu metrik): blue→indigo, emerald→teal,
  amber→orange, rose→pink (lihat `TONE_BAR` di `components/dashboard.tsx`).
- Latar permukaan sidebar/drawer: `from-white to-slate-100/80` di terang,
  `dark:from-[#14203a] dark:to-[#0c1322]` — gradien memakai **dark: variant
  eksplisit** (tidak ikut pemetaan `.dark .bg-*`).
- Hindari gradien pada teks kecil/body; kontras teks putih hanya di atas
  gradien gelap (biru→indigo), jangan di atas amber/rose terang.

## 4. Pemetaan dark mode

- Pendekatan: utility netral (bg-white/slate-*, text-slate-*, border-slate-*)
  **di-override ter-scope `.dark`** di `globals.css` (2 kelas > 1 kelas). Aksen
  & status biru/emerald/amber/red dibiarkan, badge 100↔900 di-flip.
- Karena itu: komponen baru boleh menulis utility terang biasa — tapi bila
  memakai **gradien/arbitrary color**, beri varian `dark:…` eksplisit.
- `color-scheme` disetel via `:root`/`.dark`; jangan duplikasi palet hex.

## 5. Reduced motion & aksesibilitas

- `@media (prefers-reduced-motion: reduce)` global mematikan animasi/transisi
  (sudah ada). Efek interaksi tambahan WAJIB dibungkus
  `prefers-reduced-motion: no-preference`.
- Fokus: `:focus-visible` outline 3px biru + glow ring. Status tidak boleh
  warna saja — selalu ada teks/label; ring/bar memakai `role="progressbar"`.

## 6. Checklist komponen baru

- [ ] Permukaan memakai `--shadow-soft` (+ `.card-lift` bila interaktif).
- [ ] CTA primer = gradien biru→indigo + `--glow-btn` + hover shade.
- [ ] Tidak ada bayangan/gradien hex baru; tidak ada HTML mentah.
- [ ] Dark mode: cek gradien/arbitrary punya `dark:`; netral boleh ikut map.
- [ ] Hover/animasi di bawah `no-preference`; fokus terlihat; teks bukan
      satu-satunya sinyal status.
- [ ] Snapshot visual cepat @360/@768/@1440 terang + gelap.

Referensi implementasi: `app/globals.css` (token), `components/app-shell.tsx` &
`components/app-nav.tsx` (shell/nav), `components/dashboard.tsx` (StatCard),
`components/media-embed.tsx`, `components/bulk-card.tsx`, `app/page.tsx`,
`app/(auth)/login/page.tsx`, `app/(student)/learn/page.tsx`.

## Legacy auto-upgrade (globals.css)

Agar halaman lama ikut tampil "latest" tanpa edit massal tiap file, dua aturan
kompatibel dipasang di `app/globals.css`:

- `.bg-blue-700` → tombol solid biru tua otomatis menjadi CTA gradien
  blue→indigo + `var(--glow-btn)` (+ varian `.dark`, hover `brightness`).
- `.rounded-xl.border.p-4` → kartu/form polos otomatis menjadi permukaan
  terangkat (white / `#111a2e` di dark + `--shadow-soft`).

Aturan ini SELECTOR-LEVEL (bukan utility override semua kasus berbahaya):
hanya menargetkan kombinasi lama yang sudah ditinggalkan. Komponen baru tetap
menulis kelas eksplisit — jangan mengandalkan aturan ini untuk komponen baru.
