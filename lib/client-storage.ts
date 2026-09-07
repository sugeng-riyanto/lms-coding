/**
 * Client-side pref ringan (localStorage) untuk UI authoring — mis. topik
 * AI terakhir guru. AMAN untuk SSR: fungsi mengecek `typeof window` dan
 * membungkus akses storage dengan try/catch (private mode/quota).
 *
 * Catatan: cakupan per browser/perangkat (tanpa namespace per-akun); cukup
 * untuk "reopen pre-configured". Nilai sensitif TIDAK boleh disimpan di sini.
 */

const PREFIX = "lms-ui:";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Baca pref; kembalikan null bila tidak ada/rusak. */
export function loadLocalPref<T>(key: string): T | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(PREFIX + key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Simpan pref (JSON). Hapus bila value null/undefined. */
export function saveLocalPref<T>(key: string, value: T | null | undefined): void {
  const s = storage();
  if (!s) return;
  try {
    if (value === null || value === undefined) {
      s.removeItem(PREFIX + key);
    } else {
      s.setItem(PREFIX + key, JSON.stringify(value));
    }
  } catch {
    // Quota/private mode: abaikan diam-diam (pref tidak kritis).
  }
}
