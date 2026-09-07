import { describe, expect, it } from "vitest";
import {
  MAX_ASSIGNMENT_ROWS,
  MAX_CONTENT_ROWS,
  MAX_STUDENT_ROWS,
  MAX_TEACHER_ROWS,
  MAX_UPLOAD_BYTES,
  groupContentRows,
  parseContentRows,
  parseStudentAssignmentRows,
  parseStudentRows,
  parseTeacherRows,
  rowsOverCap,
  xlsxFileError,
  type ContentRow,
} from "@/lib/bulk-import";

describe("xlsxFileError — pengaman file sisi server", () => {
  const ok = {
    name: "murid.xlsx",
    size: 1024,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  it("file valid → null", () => {
    expect(xlsxFileError(ok)).toBeNull();
  });
  it("ekstensi non-.xlsx ditolak", () => {
    expect(xlsxFileError({ ...ok, name: "murid.csv" })).toBe("FILE_MUST_BE_XLSX");
    expect(xlsxFileError({ ...ok, name: "murid.xls" })).toBe("FILE_MUST_BE_XLSX");
  });
  it("file kosong (0 byte) ditolak", () => {
    expect(xlsxFileError({ ...ok, size: 0 })).toBe("FILE_EMPTY");
  });
  it("file > 5 MB ditolak", () => {
    expect(xlsxFileError({ ...ok, size: MAX_UPLOAD_BYTES + 1 })).toBe("FILE_TOO_LARGE");
    expect(xlsxFileError({ ...ok, size: MAX_UPLOAD_BYTES })).toBeNull(); // pas di batas = aman
  });
  it("MIME mencurigakan ditolak (kecuali kosong/octet-stream/zip)", () => {
    expect(xlsxFileError({ ...ok, type: "text/html" })).toBe("FILE_MIME_REJECTED");
    expect(xlsxFileError({ ...ok, type: "application/x-msdownload" })).toBe("FILE_MIME_REJECTED");
    expect(xlsxFileError({ ...ok, type: "" })).toBeNull();
    expect(xlsxFileError({ ...ok, type: "application/octet-stream" })).toBeNull();
  });
});

describe("rowsOverCap — batas kapasitas baris", () => {
  it("di atas cap → true; pas/under → false", () => {
    expect(rowsOverCap(MAX_STUDENT_ROWS + 1, MAX_STUDENT_ROWS)).toBe(true);
    expect(rowsOverCap(MAX_STUDENT_ROWS, MAX_STUDENT_ROWS)).toBe(false);
    expect(rowsOverCap(1, MAX_STUDENT_ROWS)).toBe(false);
    expect(rowsOverCap(MAX_CONTENT_ROWS + 1, MAX_CONTENT_ROWS)).toBe(true);
  });
});

describe("parseStudentRows", () => {
  it("mengenali kolom fleksibel & menormalkan email", () => {
    const { rows, errors } = parseStudentRows([
      { Email: "  Andi@School.ID ", Nama: "Andi" },
      { "email siswa": "budi@school.id", display_name: "Budi" },
    ]);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { email: "andi@school.id", displayName: "Andi" },
      { email: "budi@school.id", displayName: "Budi" },
    ]);
  });
  it("baris rusak dilaporkan per baris, bukan menggagalkan seluruh file", () => {
    const { rows, errors } = parseStudentRows([
      { Email: "andi@school.id" },
      { Email: "bukan-email" },
      { Email: "" },
      { Email: "andi@school.id" }, // duplikat
      "bukan objek",
    ]);
    expect(rows).toHaveLength(1);
    expect(errors.length).toBe(4);
    expect(errors.some((e) => e.includes("tidak valid"))).toBe(true);
    expect(errors.some((e) => e.includes("duplikat"))).toBe(true);
    expect(errors.some((e) => e.includes("format tidak dikenali"))).toBe(true);
  });
  it("tanpa nama → fallback bagian lokal email", () => {
    const { rows } = parseStudentRows([{ Email: "citra@school.id" }]);
    expect(rows[0]?.displayName).toBe("citra");
  });
});

describe("parseTeacherRows — bulk upload guru", () => {
  it("email/nama + kelas opsional (; atau , terpisah, dedupe)", () => {
    const { rows, errors } = parseTeacherRows([
      { Email: " guru1@school.id ", Nama: "Guru Satu", Kelas: "7A; 7B , 7A" },
      { "email guru": "guru2@school.id", display_name: "Guru Dua" },
    ]);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { email: "guru1@school.id", displayName: "Guru Satu", classNames: ["7A", "7B"] },
      { email: "guru2@school.id", displayName: "Guru Dua", classNames: [] },
    ]);
  });
  it("email tidak valid / kosong / duplikat → error per baris", () => {
    const { rows, errors } = parseTeacherRows([
      { Email: "bukan-email", Nama: "X" },
      { Email: "" },
      { Email: "guru3@school.id" },
      { Email: "guru3@school.id" },
    ]);
    expect(rows).toHaveLength(1);
    expect(errors.length).toBe(3);
    expect(errors.some((e) => e.includes("tidak valid"))).toBe(true);
    expect(errors.some((e) => e.includes("kosong"))).toBe(true);
    expect(errors.some((e) => e.includes("duplikat"))).toBe(true);
  });
  it("batas baris guru (MAX_TEACHER_ROWS)", () => {
    expect(rowsOverCap(MAX_TEACHER_ROWS + 1, MAX_TEACHER_ROWS)).toBe(true);
    expect(rowsOverCap(MAX_TEACHER_ROWS, MAX_TEACHER_ROWS)).toBe(false);
  });
});

describe("parseStudentAssignmentRows — penugasan murid ke kelas/subjek", () => {
  it("mengenali alias kelas/mapel; email dinormalisasi", () => {
    const { rows, errors } = parseStudentAssignmentRows([
      { Email: " ANDI@school.id ", Kelas: "7A", Mapel: "Matematika" },
      { "email siswa": "budi@school.id", "nama kelas": "7B", course: "IPA" },
      { Email: "citra@school.id", Class: "7C" }, // hanya kelas
      { Email: "doni@school.id", Subject: "Olahraga" }, // hanya subjek
    ]);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { email: "andi@school.id", className: "7A", subjectName: "Matematika" },
      { email: "budi@school.id", className: "7B", subjectName: "IPA" },
      { email: "citra@school.id", className: "7C", subjectName: "" },
      { email: "doni@school.id", className: "", subjectName: "Olahraga" },
    ]);
  });
  it("kelas DAN mapel kosong → error; kombinasi duplikat → error", () => {
    const { rows, errors } = parseStudentAssignmentRows([
      { Email: "andi@school.id", Kelas: "", Mapel: "" },
      { Email: "budi@school.id", Kelas: "7A", Mapel: "Math" },
      { Email: "budi@school.id", Kelas: "7A", Mapel: "Math" },
    ]);
    expect(rows).toHaveLength(1);
    expect(errors.length).toBe(2);
    expect(errors[0]).toContain("wajib");
    expect(errors[1]).toContain("duplikat");
  });
  it("email tak valid → error; batas baris (MAX_ASSIGNMENT_ROWS)", () => {
    const { errors } = parseStudentAssignmentRows([{ Email: "bukan-email", Kelas: "7A" }]);
    expect(errors[0]).toContain("tidak valid");
    expect(rowsOverCap(MAX_ASSIGNMENT_ROWS + 1, MAX_ASSIGNMENT_ROWS)).toBe(true);
  });
});

describe("parseContentRows", () => {
  const VALID = [
    "Modul 1",
    "Pelajaran 1",
    "Tujuan",
    "code_board",
    "Blok Kode",
    '{"code":"print(1)","language":"python"}',
  ];
  const header = ["Module", "Lesson", "Objective", "Activity Type", "Activity Title", "Content JSON"];

  function sheet(rows: (string | number)[][]) {
    return rows.map((vals) => Object.fromEntries(header.map((h, i) => [h, vals[i]])));
  }

  it("baris valid → row lengkap + contentJson ter-parse", () => {
    const { rows, errors } = parseContentRows(sheet([VALID]));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      module: "Modul 1",
      lesson: "Pelajaran 1",
      activityType: "code_board",
      activityTitle: "Blok Kode",
    });
    expect(rows[0]?.contentJson).toEqual({ code: "print(1)", language: "python" });
  });

  it("tipe aktivitas tak dikenal → error, konten JSON rusak → error", () => {
    const { rows, errors } = parseContentRows(
      sheet([
        ["M1", "L1", "", "video_embed", "A1", ""],
        ["M1", "L2", "", "article", "A2", "{rusak"],
      ]),
    );
    expect(rows).toHaveLength(0);
    expect(errors.length).toBe(2);
    expect(errors[0]?.toLowerCase()).toContain("tipe aktivitas");
    expect(errors[1]?.toLowerCase()).toContain("json");
  });

  it("module/lesson wajib; konten JSON harus objek", () => {
    const { rows, errors } = parseContentRows(sheet([["", "L", "", "article", "A", ""]]));
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain("wajib");
  });

  it("groupContentRows mengelompokkan module→lesson", () => {
    const rows: ContentRow[] = [
      {
        module: "M1",
        lesson: "L1",
        objective: "",
        activityType: "article",
        activityTitle: "a",
        contentJson: null,
      },
      {
        module: "M1",
        lesson: "L1",
        objective: "",
        activityType: "article",
        activityTitle: "b",
        contentJson: null,
      },
      {
        module: "M1",
        lesson: "L2",
        objective: "",
        activityType: "article",
        activityTitle: "c",
        contentJson: null,
      },
      {
        module: "M2",
        lesson: "L1",
        objective: "",
        activityType: "article",
        activityTitle: "d",
        contentJson: null,
      },
    ];
    const g = groupContentRows(rows);
    expect(g.size).toBe(2);
    expect(g.get("M1")?.get("L1")).toHaveLength(2);
    expect(g.get("M2")?.get("L1")).toHaveLength(1);
  });
});
