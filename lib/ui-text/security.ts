import type { TextDict } from "@/lib/i18n";

/** Admin security & monitoring: `/teacher/admin/security` page + SecurityMonitor. */
export const SECURITY = {
  // Page shell
  denied: {
    id: "Halaman admin hanya untuk guru yang memiliki course di organisasi ini (facet Owner, ADR-008).",
    en: "This admin page is for teachers who own a course in this organization (Owner facet, ADR-008).",
  },
  backToDashboard: { id: "Kembali ke dashboard", en: "Back to dashboard" },
  backToAdmin: { id: "← Admin", en: "← Admin" },
  title: { id: "Admin — Security & monitoring", en: "Admin — Security & monitoring" },
  subtitle: {
    id: "Pantau laporan Content-Security-Policy dari browser. Lonjakan (spike) bisa menandakan percobaan injection — lihat juga baris log csp-alert dan DEPLOYMENT.md §7.3 untuk ambang batas serta tindakan.",
    en: "Monitor Content-Security-Policy reports from browsers. A spike may indicate an injection attempt — see also the csp-alert log lines and DEPLOYMENT.md §7.3 for thresholds and actions.",
  },

  // SecurityMonitor
  sectionAria: { id: "Monitoring laporan CSP", en: "CSP report monitoring" },
  heading: { id: "Security & monitoring", en: "Security & monitoring" },
  refresh: { id: "Muat ulang", en: "Refresh" },
  refreshing: { id: "Memuat ulang…", en: "Refreshing…" },

  alertSpike: { id: "Spike laporan CSP terdeteksi", en: "CSP report spike detected" },
  alertBody: {
    id: "— kemungkinan percobaan injection. Periksa baris log csp-alert dan endpoint /api/csp-report (DEPLOYMENT.md §7.3).",
    en: " — possibly an injection attempt. Check the csp-alert log lines and the /api/csp-report endpoint (DEPLOYMENT.md §7.3).",
  },
  noSpike: { id: "Tidak ada spike laporan CSP.", en: "No CSP report spike." },
  noSpikeBody: {
    id: "Rate saat ini di bawah ambang {threshold}/menit.",
    en: "Current rate is below the {threshold}/min threshold.",
  },
  refreshFailed: { id: "Gagal memuat ulang: {error}", en: "Failed to refresh: {error}" },
  refreshFailedGeneric: { id: "Gagal memuat ulang.", en: "Failed to refresh." },
  unknownResponse: { id: "Respons tidak dikenal", en: "Unknown response" },

  cardRate: { id: "Rate saat ini", en: "Current rate" },
  cardRateUnit: { id: "/menit", en: "/min" },
  cardRateHint: { id: "ambang {threshold}/menit", en: "threshold {threshold}/min" },
  cardViolations: { id: "Pelanggaran / menit", en: "Violations / min" },
  cardBlocked: { id: "Diblokir rate-limiter / menit", en: "Blocked by rate-limiter / min" },
  cardSample: { id: "Sample (jendela)", en: "Sample (window)" },
  cardSampleHint: { id: "{seconds} detik", en: "{seconds} seconds" },
  cardTotal: { id: "Total sejak proses start", en: "Total since process start" },
  cardBlockedTotal: { id: "Total diblokir", en: "Total blocked" },
  cardLastViolation: { id: "Pelanggaran terakhir", en: "Last violation" },
  cardLastUpdated: { id: "Terakhir diperbarui", en: "Last updated" },

  chart24: { id: "Riwayat 24 jam", en: "24-hour history" },
  chart7d: { id: "Riwayat 7 hari", en: "7-day history" },
  chartTotal: { id: "Total: {total} event", en: "Total: {total} events" },
  chartRangeAria: { id: "Rentang waktu grafik CSP", en: "CSP chart time range" },
  range24h: { id: "24 jam", en: "24h" },
  range7d: { id: "7 hari", en: "7d" },
  barHint: { id: "V:{v} B:{b}", en: "V:{v} B:{b}" },

  footer: {
    id: "Nilai agregat saja — tidak ada URI, detail directive, atau PII. State persisted di Supabase table csp_events (restart-safe, multi-instance). Toggle 24 jam / 7 hari untuk membedakan burst sesaat dari serangan berkelanjutan.",
    en: "Aggregates only — no URIs, directive details, or PII. State persists in the Supabase csp_events table (restart-safe, multi-instance). Toggle 24h / 7d to tell a one-off burst from a sustained attack.",
  },
} as const satisfies TextDict;
