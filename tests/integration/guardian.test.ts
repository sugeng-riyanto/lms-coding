import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guardian dashboard slice (Wali): RBAC.md "Lihat ringkasan anak tertaut" kini
 * punya UI + route. Bukti statis — perilaku RLS sesungguhnya diuji live di
 * scripts/live-denial (p04_*: linked/unlinked child).
 */
const layout = readFileSync("app/(guardian)/layout.tsx", "utf8");
const page = readFileSync("app/(guardian)/guardian/page.tsx", "utf8");
const hub = readFileSync("app/dashboard/page.tsx", "utf8");
const login = readFileSync("app/(auth)/login/page.tsx", "utf8");
const seed = readFileSync("supabase/seed.sql", "utf8");

describe("guardian dashboard slice (Wali) — route coverage", () => {
  it("guard layout mengunci route /guardian ke role guardian server-side", () => {
    expect(layout).toMatch(/export const dynamic = "force-dynamic"/);
    expect(layout).toMatch(/requireActiveMembership\(\["guardian"\]\)/);
  });
  it("halaman hanya membaca ringkasan via guardian link aktif milik user", () => {
    expect(page).toMatch(/from\("guardian_links"\)/);
    expect(page).toMatch(/eq\("guardian_id", userId\)/);
    expect(page).toMatch(/eq\("status", "active"\)/);
    // Permukaan data = tabel ber-policy guardian (profil/enrollment/progress),
    // bukan attempts/responses (nilai & jawaban tidak boleh ke wali).
    expect(page).toMatch(/from\("profiles"\)/);
    expect(page).toMatch(/from\("enrollments"\)/);
    expect(page).toMatch(/from\("progress_snapshots"\)/);
    expect(page).not.toMatch(/from\("attempts"\)/);
    expect(page).not.toMatch(/from\("responses"\)/);
  });
  it("login → hub peran → dashboard Wali (role resolve server-side)", () => {
    expect(login).toMatch(/router\.push\("\/dashboard"\)/);
    expect(hub).toMatch(/DASHBOARD_BY_ROLE/);
    expect(hub).toMatch(/role: "guardian", path: "\/guardian"/);
    expect(hub).toMatch(/for \(const \{ role, path \} of DASHBOARD_BY_ROLE\)/);
    expect(hub).toMatch(/redirect\(path\)/);
    // role di-resolve dari memberships (server-side), bukan dari client payload.
    expect(hub).toMatch(/\.from\("memberships"\)/);
    expect(hub).toMatch(/assertServerResolvedRole/);
  });
  it("seed anonim: akun Wali + guardian link aktif ke Murid 01", () => {
    expect(seed).toMatch(/wali@demo\.local/);
    expect(seed).toMatch(
      /guardian_links[\s\S]*?'a5000000-0000-0000-0000-000000000001'[\s\S]*?'b0000000-0000-0000-0000-000000000001'[\s\S]*?'active'/,
    );
  });
});
