import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync("features/actions.ts", "utf8");
const helper = readFileSync("lib/org-admin.ts", "utf8");
const validation = readFileSync("lib/validation.ts", "utf8");
const page = readFileSync("app/(teacher)/teacher/admin/map/page.tsx", "utf8");
const dashboard = readFileSync("app/(teacher)/teacher/page.tsx", "utf8");

describe("lib/org-admin — gate org-admin (facet Owner, ADR-008)", () => {
  it("urutan gate: claims → membership teacher aktif → memiliki course di org", () => {
    expect(helper).toMatch(/export async function getOrgAdminContext/);
    expect(helper).toMatch(/memberships/);
    expect(helper).toMatch(/eq\("role", "teacher"\)/);
    expect(helper).toMatch(/eq\("status", "active"\)/);
    expect(helper).toMatch(/from\("courses"\)/);
    expect(helper).toMatch(/eq\("owner_id", uid\)/);
    expect(helper).toMatch(/eq\("organization_id", orgId\)/);
    // Hanya strict client (RLS) — bukan service key di helper.
    expect(helper).not.toMatch(/createServiceClient/);
  });
});

describe("aksi admin org (features/actions.ts)", () => {
  it("bulkImportTeachers: gate org-admin + xlsx guard + service provisioning + kolom kelas", () => {
    const fn = actions.slice(actions.indexOf("export async function bulkImportTeachers"));
    expect(fn).toMatch(/xlsxFileError\(file\)/);
    expect(fn).toMatch(/getOrgAdminContext\(\)/);
    expect(fn).toMatch(/MAX_TEACHER_ROWS/);
    expect(fn).toMatch(/createServiceClient\(\)/);
    expect(fn).toMatch(/role: "teacher"/);
    expect(fn).toMatch(/from\("cohorts"\)/);
    expect(fn).toMatch(/currentAcademicYear\(\)/);
  });

  it("bulkImportStudentAssignments: kelas (cohort) + subjek (course) via upsert idempoten", () => {
    const fn = actions.slice(actions.indexOf("export async function bulkImportStudentAssignments"));
    expect(fn).toMatch(/parseStudentAssignmentRows/);
    expect(fn).toMatch(/getOrgAdminContext\(\)/);
    expect(fn).toMatch(/from\("cohorts"\)/);
    expect(fn).toMatch(/from\("courses"\)/);
    expect(fn).toMatch(/from\("cohort_members"\)/);
    expect(fn).toMatch(/onConflict: "cohort_id,student_id"/);
    expect(fn).toMatch(/from\("enrollments"\)/);
    expect(fn).toMatch(/onConflict: "course_id,student_id,cohort_id"/);
  });

  it("saveStudentMapping + assignTeacherToClass: gate org-admin + validasi id org", () => {
    const save = actions.slice(actions.indexOf("export async function saveStudentMapping"));
    expect(save).toMatch(/saveStudentMappingSchema/);
    expect(save).toMatch(/getOrgAdminContext\(\)/);
    expect(save).toMatch(/NOT_FOUND_OR_FORBIDDEN/);
    const assign = actions.slice(actions.indexOf("export async function assignTeacherToClass"));
    expect(assign).toMatch(/assignTeacherToClassSchema/);
    expect(assign).toMatch(/getOrgAdminContext\(\)/);
    expect(assign).toMatch(/TEACHER_NOT_FOUND/);
    expect(assign).toMatch(/CLASS_NOT_FOUND/);
    expect(assign).toMatch(/update\(\{ teacher_id/);
  });

  it("schema validasi membatasi jumlah id mapping (max 20)", () => {
    expect(validation).toMatch(/saveStudentMappingSchema/);
    expect(validation).toMatch(/z\.array\(uuidSchema\)\.max\(20\)/);
    expect(validation).toMatch(/assignTeacherToClassSchema/);
  });
});

describe("halaman /teacher/admin/map", () => {
  it("force-dynamic + penjaga org-admin + komponen import + data org-wide via service", () => {
    expect(page).toMatch(/export const dynamic = "force-dynamic"/);
    expect(page).toMatch(/getOrgAdminContext\(\)/);
    // Teks penolakan admin dipindah ke dictionary bilingual (lib/ui-text/admin-map).
    expect(page).not.toMatch(/Halaman admin hanya untuk guru yang memiliki course/);
    expect(page).toMatch(/ADMIN_MAP/);
    expect(page).toMatch(/TeacherBulkImport/);
    expect(page).toMatch(/AssignmentBulkImport/);
    expect(page).toMatch(/MappingPanel/);
    // Data org-wide (kelas/subjek/murid/guru) = pengecualian admin via service client.
    expect(page).toMatch(/createServiceClient/);
    expect(page).toMatch(/from\("cohorts"\)/);
    expect(page).toMatch(/from\("courses"\)/);
    expect(page).toMatch(/eq\("role", "student"\)/);
    expect(page).toMatch(/eq\("role", "teacher"\)/);
  });
});

describe("dashboard guru — tautan admin hanya untuk org-admin", () => {
  it("link /teacher/admin/map digabung ke adminCtx (bukan semua guru)", () => {
    expect(dashboard).toMatch(/getOrgAdminContext\(\)/);
    expect(dashboard).toMatch(/adminCtx && \[/);
    expect(dashboard).toMatch(/["']\/teacher\/admin\/map["']/);
  });
});
