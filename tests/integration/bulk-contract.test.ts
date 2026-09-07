import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_TYPE_ALLOWLIST,
  MAX_ASSIGNMENT_ROWS,
  MAX_CONTENT_ROWS,
  MAX_STUDENT_ROWS,
  MAX_TEACHER_ROWS,
  parseContentRows,
  parseStudentAssignmentRows,
  parseStudentRows,
  parseTeacherRows,
} from "@/lib/bulk-import";
import { BULK_TEMPLATES, type BulkTemplateKind, escapeXlsxCell } from "@/lib/bulk-template";
import { uuidSchema } from "@/lib/validation";
import { buildXlsxBuffer } from "@/lib/bulk-xlsx";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";

/**
 * Kontrak bulk XLSX: template ↔ parser ↔ database ↔ API.
 * - Header template WAJIB dimengerti parser (contoh baris parse 0 error).
 * - Kolom ekspor WAJIB diawali header template (round-trip: unduh → edit → impor).
 * - Tipe aktivitas allowlist = CHECK database (migration 000014).
 * - Berkas tidak pernah ditulis ke disk (parse memori; form reset setelah sukses).
 */

function toObjects(headers: string[], sample: string[][]): Record<string, string>[] {
  return sample.map((row) => Object.fromEntries(row.map((v, i) => [headers[i]!, v])));
}

describe("template ↔ parser (single source of truth)", () => {
  it("students: contoh parse bersih", () => {
    const t = BULK_TEMPLATES.students;
    const { rows, errors } = parseStudentRows(toObjects(t.headers, t.sample));
    expect(errors).toEqual([]);
    expect(rows.length).toBe(t.sample.length);
  });

  it("content: contoh parse bersih", () => {
    const t = BULK_TEMPLATES.content;
    const { rows, errors } = parseContentRows(toObjects(t.headers, t.sample));
    expect(errors).toEqual([]);
    expect(rows.length).toBe(t.sample.length);
    expect(rows[0]?.activityType).toBe("article");
  });

  it("teachers: contoh parse bersih", () => {
    const t = BULK_TEMPLATES.teachers;
    const { rows, errors } = parseTeacherRows(toObjects(t.headers, t.sample));
    expect(errors).toEqual([]);
    expect(rows.length).toBe(t.sample.length);
    expect(rows[0]?.classNames).toEqual(["Kelas 7A", "Kelas 7B"]);
  });

  it("assignments: contoh parse bersih", () => {
    const t = BULK_TEMPLATES.assignments;
    const { rows, errors } = parseStudentAssignmentRows(toObjects(t.headers, t.sample));
    expect(errors).toEqual([]);
    expect(rows.length).toBe(t.sample.length);
  });

  it("kapasitas template = konstanta guard server", () => {
    expect(BULK_TEMPLATES.students.capacity).toBe(MAX_STUDENT_ROWS);
    expect(BULK_TEMPLATES.content.capacity).toBe(MAX_CONTENT_ROWS);
    expect(BULK_TEMPLATES.teachers.capacity).toBe(MAX_TEACHER_ROWS);
    expect(BULK_TEMPLATES.assignments.capacity).toBe(MAX_ASSIGNMENT_ROWS);
  });
});

describe("workbook template valid + anti formula-injection", () => {
  it("setiap template membangun .xlsx yang terbaca kembali dengan header utuh", () => {
    for (const kind of Object.keys(BULK_TEMPLATES) as BulkTemplateKind[]) {
      const t = BULK_TEMPLATES[kind];
      const buf = buildXlsxBuffer(t.sheet, t.headers, t.sample);
      expect(buf.length).toBeGreaterThan(0);
      const wb = xlsxRead(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      const rows = xlsxUtils.sheet_to_json(ws, { header: 1 }) as string[][];
      expect(rows[0]).toEqual(t.headers);
      expect(rows.length).toBe(t.sample.length + 1);
    }
  });

  it("sel berbahaya (=,@,+) diawali kutip satu", () => {
    expect(escapeXlsxCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeXlsxCell("@cmd")).toBe("'@cmd");
    expect(escapeXlsxCell("Normal")).toBe("Normal");
    expect(escapeXlsxCell(42)).toBe("42");
  });
});

describe("ekspor ↔ template (round-trip)", () => {
  const roster = readFileSync("app/api/export/cohorts/[cohortId]/xlsx/route.ts", "utf8");
  const materi = readFileSync("app/api/export/courses/[courseId]/xlsx/route.ts", "utf8");

  it("roster diawali header template murid + otorisasi pemilik cohort", () => {
    expect(roster).toContain('["Email", "Nama", "Status"]');
    expect(roster).toMatch(/eq\("teacher_id", uid\)/);
    expect(roster).toMatch(/FORBIDDEN/);
  });

  it("materi memakai 6 header template + otorisasi pemilik course", () => {
    for (const h of BULK_TEMPLATES.content.headers) {
      expect(materi).toContain(`"${h}"`);
    }
    expect(materi).toMatch(/eq\("owner_id", uid\)/);
    expect(materi).toMatch(/FORBIDDEN/);
  });

  it("route template mengunci peran (guru vs org-admin) + 404 kind asing", () => {
    const route = readFileSync("app/api/bulk/templates/[kind]/route.ts", "utf8");
    expect(route).toMatch(/getOrgAdminContext/);
    expect(route).toMatch(/eq\("role", "teacher"\)/);
    expect(route).toMatch(/UNKNOWN_TEMPLATE/);
  });
});

describe("tipe aktivitas = CHECK database", () => {
  it("allowlist persis sama dengan constraint 000014", () => {
    const migration = readFileSync("supabase/migrations/20260906000014_coding_media_activities.sql", "utf8");
    for (const t of ACTIVITY_TYPE_ALLOWLIST) {
      expect(migration).toContain(`'${t}'`);
    }
    const checkValues = [...migration.matchAll(/'([a-z_]+)'/g)]
      .map((m) => m[1]!)
      .filter((v) => (ACTIVITY_TYPE_ALLOWLIST as readonly string[]).includes(v));
    expect(new Set(checkValues).size).toBe(ACTIVITY_TYPE_ALLOWLIST.length);
  });
});

describe("uuidSchema menerima UUID seed (format hex, varian apa pun)", () => {
  it("ID seed tetap lolos; sampah ditolak", () => {
    for (const id of [
      "c0000000-0000-0000-0000-000000000001",
      "b0000000-0000-0000-0000-000000000001",
      "11111111-1111-1111-1111-111111111111",
      "36c1dfa1-ff0a-4595-898e-c9cc5734086b",
    ]) {
      expect(uuidSchema.safeParse(id).success, id).toBe(true);
    }
    for (const bad of ["not-uuid", "", "c0000000-0000", "xxxxxxxx-0000-0000-0000-000000000001"]) {
      expect(uuidSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("berkas dibuang setelah sukses (tidak disimpan di disk)", () => {
  it("jalur bulk server tanpa tulis file", () => {
    const actions = readFileSync("features/actions.ts", "utf8");
    expect(actions).not.toMatch(/writeFile|createWriteStream|unlinkSync|renameSync/);
    expect(actions).not.toMatch(/from "node:fs"|from 'node:fs'|require\("fs"\)/);
  });

  it("resolusi identitas via Auth Admin API (PostgREST tidak mengekspos skema auth)", () => {
    const actions = readFileSync("features/actions.ts", "utf8");
    expect(actions).not.toMatch(/schema\("auth"\)/);
    expect(actions).toMatch(/auth\.admin\.listUsers/);
    const roster = readFileSync("app/api/export/cohorts/[cohortId]/xlsx/route.ts", "utf8");
    expect(roster).not.toMatch(/schema\("auth"\)/);
    expect(roster).toMatch(/auth\.admin\.listUsers/);
  });

  it("keempat kartu mereset form setelah sukses + menautkan template", () => {
    const files = [
      "app/(teacher)/teacher/cohorts/student-bulk-import.tsx",
      "app/(teacher)/teacher/courses/[id]/levels/[levelId]/content-bulk-import.tsx",
      "app/(teacher)/teacher/admin/map/teacher-bulk-import.tsx",
      "app/(teacher)/teacher/admin/map/assignment-bulk-import.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/\.reset\(\)/);
      expect(src, f).toMatch(/templateKind="/);
      expect(src, f).toMatch(/<BulkCard/);
    }
    // URL unduhan dibangun di dalam BulkCard dari templateKind.
    const shell = readFileSync("components/bulk-card.tsx", "utf8");
    expect(shell).toMatch(/\/api\/bulk\/templates\/\$\{templateKind\}/);
  });
});
