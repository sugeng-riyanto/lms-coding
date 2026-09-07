/**
 * Validator murni untuk bulk upload XLSX (murid & materi).
 *
 * Parser XLSX (sheet_to_json) dilakukan di server action; fungsi di sini
 * menormalkan + memvalidasi baris hasil parse — deterministik & teruji tanpa
 * file. Semua nilai dinormalisasi (trim, lower email) dan baris rusak
 * dilaporkan per-baris (tidak menggagalkan seluruh upload).
 */

// ---- Pengaman sisi server (XLSX): ukuran, MIME, kapasitas baris ----

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const MAX_STUDENT_ROWS = 500;
export const MAX_CONTENT_ROWS = 1000;
export const MAX_TEACHER_ROWS = 200;
export const MAX_ASSIGNMENT_ROWS = 1000;

const ALLOWED_XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "application/zip",
]);

/** Periksa file XLSX (nama/ukuran/MIME) → pesan error atau null bila aman. */
export function xlsxFileError(file: { name: string; size: number; type: string }): string | null {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return "FILE_MUST_BE_XLSX";
  if (file.size <= 0) return "FILE_EMPTY";
  if (file.size > MAX_UPLOAD_BYTES) return "FILE_TOO_LARGE";
  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_XLSX_MIME.has(mime)) return "FILE_MIME_REJECTED";
  return null;
}

export function rowsOverCap(count: number, max: number): boolean {
  return count > max;
}

export const ACTIVITY_TYPE_ALLOWLIST = [
  "article",
  "video_link",
  "resource",
  "reflection",
  "quiz",
  "assignment_upload",
  "roblox_challenge",
  "code_board",
  "embed_youtube",
  "embed_pdf",
  "embed_audio",
  "embed_file",
] as const;

export type BulkActivityType = (typeof ACTIVITY_TYPE_ALLOWLIST)[number];

export interface StudentRow {
  email: string;
  displayName: string;
}

export interface StudentParseResult {
  rows: StudentRow[];
  errors: string[];
}

export interface TeacherRow {
  email: string;
  displayName: string;
  /** Nama kelas (cohort) yang diampu — kolom opsional, bisa ; / , terpisah. */
  classNames: string[];
}

export interface TeacherParseResult {
  rows: TeacherRow[];
  errors: string[];
}

export interface StudentAssignmentRow {
  email: string;
  /** Nama kelas (cohort) — opsional per baris. */
  className: string;
  /** Nama subjek (course) — opsional per baris. */
  subjectName: string;
}

export interface StudentAssignmentParseResult {
  rows: StudentAssignmentRow[];
  errors: string[];
}

export interface ContentRow {
  module: string;
  lesson: string;
  objective: string;
  activityType: BulkActivityType;
  activityTitle: string;
  contentJson: Record<string, unknown> | null;
}

export interface ContentParseResult {
  rows: ContentRow[];
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Baca kolom fleksibel: cari kunci pertama yang cocok dengan salah satu alias. */
function pick(row: Record<string, unknown>, aliases: string[]): string {
  for (const key of Object.keys(row)) {
    const k = key.trim().toLowerCase();
    if (aliases.includes(k)) {
      const v = row[key];
      return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
    }
  }
  return "";
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseStudentRows(sheetRows: unknown[]): StudentParseResult {
  const rows: StudentRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let line = 1;
  for (const raw of sheetRows) {
    line++;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`Baris ${line}: format tidak dikenali.`);
      continue;
    }
    const rec = raw as Record<string, unknown>;
    const email = normalizeEmail(pick(rec, ["email", "e-mail", "email siswa", "emailmurid"]));
    const displayName = pick(rec, ["nama", "name", "display_name", "nama siswa", "namamurid"]);
    if (!email) {
      errors.push(`Baris ${line}: email kosong.`);
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push(`Baris ${line}: email tidak valid ("${email}").`);
      continue;
    }
    if (seen.has(email)) {
      errors.push(`Baris ${line}: email duplikat dalam file ("${email}").`);
      continue;
    }
    seen.add(email);
    rows.push({ email, displayName: (displayName || email.split("@")[0]) ?? email });
  }
  return { rows, errors };
}

export function parseContentRows(sheetRows: unknown[]): ContentParseResult {
  const rows: ContentRow[] = [];
  const errors: string[] = [];
  let line = 1;
  for (const raw of sheetRows) {
    line++;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`Baris ${line}: format tidak dikenali.`);
      continue;
    }
    const rec = raw as Record<string, unknown>;
    const moduleTitle = pick(rec, ["module", "modul"]);
    const lesson = pick(rec, ["lesson", "pelajaran", "judul pelajaran"]);
    const objective = pick(rec, ["objective", "tujuan"]);
    const activityType = pick(rec, ["activity type", "activitytype", "tipe aktivitas", "jenis"]);
    const activityTitle = pick(rec, ["activity title", "activitytitle", "judul aktivitas"]);
    const contentRaw = pick(rec, ["content json", "contentjson", "konten"]);

    if (!moduleTitle || !lesson) {
      errors.push(`Baris ${line}: module & lesson wajib diisi.`);
      continue;
    }
    if (!activityTitle) {
      errors.push(`Baris ${line}: judul aktivitas kosong (module "${moduleTitle}", lesson "${lesson}").`);
      continue;
    }
    if (!ACTIVITY_TYPE_ALLOWLIST.includes(activityType as BulkActivityType)) {
      errors.push(
        `Baris ${line}: tipe aktivitas "${activityType || "(kosong)"}" tidak dikenal. ` +
          `Gunakan: ${ACTIVITY_TYPE_ALLOWLIST.join(", ")}.`,
      );
      continue;
    }
    let contentJson: Record<string, unknown> | null = null;
    if (contentRaw) {
      try {
        const parsed: unknown = JSON.parse(contentRaw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          errors.push(`Baris ${line}: konten JSON harus berupa objek.`);
          continue;
        }
        contentJson = parsed as Record<string, unknown>;
      } catch {
        errors.push(`Baris ${line}: konten JSON tidak valid (module "${moduleTitle}", lesson "${lesson}").`);
        continue;
      }
    }
    rows.push({
      module: moduleTitle,
      lesson,
      objective,
      activityType: activityType as BulkActivityType,
      activityTitle,
      contentJson,
    });
  }
  return { rows, errors };
}

/** Pecah daftar kelas (alias ; / , ) → unik, trim, tanpa kosong. */
function splitClasses(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Baris guru: Email (wajib) + Nama + Kelas (opsional, ; / , terpisah). */
export function parseTeacherRows(sheetRows: unknown[]): TeacherParseResult {
  const rows: TeacherRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let line = 1;
  for (const raw of sheetRows) {
    line++;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`Baris ${line}: format tidak dikenali.`);
      continue;
    }
    const rec = raw as Record<string, unknown>;
    const email = normalizeEmail(pick(rec, ["email", "e-mail", "email guru", "emailguru"]));
    const displayName = pick(rec, ["nama", "name", "display_name", "nama guru", "namaguru"]);
    const classesRaw = pick(rec, ["kelas", "class", "classes", "kelas yang diampu", "kelasdiampu"]);
    if (!email) {
      errors.push(`Baris ${line}: email kosong.`);
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push(`Baris ${line}: email tidak valid ("${email}").`);
      continue;
    }
    if (seen.has(email)) {
      errors.push(`Baris ${line}: email duplikat dalam file ("${email}").`);
      continue;
    }
    seen.add(email);
    rows.push({
      email,
      displayName: (displayName || email.split("@")[0]) ?? email,
      classNames: splitClasses(classesRaw),
    });
  }
  return { rows, errors };
}

/** Baris penugasan murid: Email (wajib) + Kelas (opsional) + Subjek (opsional).
 * Minimal salah satu dari kelas/subjek wajib diisi per baris. */
export function parseStudentAssignmentRows(sheetRows: unknown[]): StudentAssignmentParseResult {
  const rows: StudentAssignmentRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let line = 1;
  for (const raw of sheetRows) {
    line++;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`Baris ${line}: format tidak dikenali.`);
      continue;
    }
    const rec = raw as Record<string, unknown>;
    const email = normalizeEmail(pick(rec, ["email", "e-mail", "email siswa", "emailmurid"]));
    const className = pick(rec, ["kelas", "class", "nama kelas", "namakelas"]);
    const subjectName = pick(rec, ["subjek", "mapel", "subject", "mata pelajaran", "course", "namamapel"]);
    if (!email) {
      errors.push(`Baris ${line}: email kosong.`);
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push(`Baris ${line}: email tidak valid ("${email}").`);
      continue;
    }
    if (!className && !subjectName) {
      errors.push(`Baris ${line}: kelas atau subjek wajib diisi ("${email}").`);
      continue;
    }
    const key = `${email}|${className}|${subjectName}`;
    if (seen.has(key)) {
      errors.push(`Baris ${line}: kombinasi email/kelas/subjek duplikat.`);
      continue;
    }
    seen.add(key);
    rows.push({ email, className, subjectName });
  }
  return { rows, errors };
}

/** Kelompokkan baris konten per module→lesson untuk menentukan posisi. */
export function groupContentRows(rows: ContentRow[]): Map<string, Map<string, ContentRow[]>> {
  const out = new Map<string, Map<string, ContentRow[]>>();
  for (const r of rows) {
    if (!out.has(r.module)) out.set(r.module, new Map());
    const lessons = out.get(r.module)!;
    if (!lessons.has(r.lesson)) lessons.set(r.lesson, []);
    lessons.get(r.lesson)!.push(r);
  }
  return out;
}
