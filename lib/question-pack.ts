/**
 * Question pack — template teks efisien untuk bank soal (MCQ / esai / kombinasi).
 *
 * Format SATU SOAL per baris, kolom dipisah `|`:
 *   TIPE | Prompt | OpsiA | OpsiB | OpsiC | OpsiD | Kunci | Poin | Catatan
 *
 * - TIPE: single_choice | multiple_choice | true_false | essay_manual
 *   (alias singkat: sc / mc / tf / essay)
 * - Kunci: sc → huruf opsi (A–D); mc → huruf dipisah `;`/`,` (A;C);
 *   tf → `benar` atau `salah`; essay → kosong (dinilai manual; Catatan =
 *   pedoman/model jawaban untuk guru, disimpan explanation_json).
 * - Poin default 10; Catatan opsional.
 *
 * Parser murni (tanpa DB/UI): tiap baris divalidasi struktural; error dikumpulkan
 * per baris sehingga satu baris salah tidak menggagalkan baris lain.
 */

export type PackQuestionType = "single_choice" | "multiple_choice" | "true_false" | "essay_manual";

export interface PackQuestionRow {
  line: number;
  type: PackQuestionType;
  prompt: string;
  options: string[]; // hanya untuk choice (diisi dari kolom A–D)
  /** A/B/C/D; multi "A;C"; tf "benar"|"salah"; essay "". */
  key: string;
  points: number;
  note: string;
}

export interface QuestionPackResult {
  rows: PackQuestionRow[];
  errors: string[];
}

const TYPE_ALIASES: Record<string, PackQuestionType> = {
  single_choice: "single_choice",
  sc: "single_choice",
  multiple_choice: "multiple_choice",
  mc: "multiple_choice",
  true_false: "true_false",
  tf: "true_false",
  essay_manual: "essay_manual",
  essay: "essay_manual",
  esai: "essay_manual",
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export function parseQuestionPack(text: string): QuestionPackResult {
  const errors: string[] = [];
  const rows: PackQuestionRow[] = [];
  const lines = String(text ?? "").split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) return; // kosong / komentar
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length < 2) {
      errors.push(`Baris ${lineNo}: format salah (butuh setidaknya TIPE|Prompt).`);
      return;
    }
    const typeRaw = (parts[0] ?? "").toLowerCase();
    const type = TYPE_ALIASES[typeRaw];
    if (!type) {
      errors.push(`Baris ${lineNo}: tipe "${parts[0]}" tak dikenal (sc/mc/tf/essay).`);
      return;
    }
    const prompt = (parts[1] ?? "").trim();
    if (prompt.length < 3) {
      errors.push(`Baris ${lineNo}: prompt terlalu pendek.`);
      return;
    }
    const optionCells = (parts.slice(2, 6) ?? []).map((s) => s.trim());
    const options = optionCells.filter((s) => s.length > 0);
    const rawKey = ((parts[6] ?? "") as string).trim();
    const pointsRaw = Number((parts[7] ?? "10").trim());
    const points = Number.isFinite(pointsRaw) && pointsRaw >= 0 ? pointsRaw : 10;
    const note = ((parts[8] ?? "") as string).trim();

    if (type === "single_choice" || type === "multiple_choice") {
      if (options.length < 2) {
        errors.push(`Baris ${lineNo}: soal pilihan butuh ≥2 opsi (kolom OpsiA–D).`);
        return;
      }
      if (rawKey.length === 0) {
        errors.push(`Baris ${lineNo}: kunci wajib (contoh A atau A;C).`);
        return;
      }
      const keys =
        type === "multiple_choice"
          ? rawKey
              .split(/[;,]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [rawKey];
      const invalid = keys.filter((k) => !LETTERS.slice(0, options.length).includes(k.toUpperCase()));
      if (invalid.length > 0) {
        errors.push(
          `Baris ${lineNo}: kunci ${invalid.join(",")} di luar opsi A–${LETTERS[options.length - 1]}.`,
        );
        return;
      }
    } else if (type === "true_false") {
      if (rawKey && !["benar", "salah", "true", "false"].includes(rawKey.toLowerCase())) {
        errors.push(`Baris ${lineNo}: kunci true_false harus "benar" atau "salah".`);
        return;
      }
    }
    // essay: kunci dikosongkan; catatan jadi pedoman guru.

    rows.push({ line: lineNo, type, prompt, options, key: rawKey, points, note });
  });

  return { rows, errors };
}

export function questionPackTemplateSample(): string {
  return [
    "# TIPE | Prompt | OpsiA | OpsiB | OpsiC | OpsiD | Kunci | Poin | Catatan",
    "sc | Apa output dari print(2 ** 3)? | 6 | 8 | 9 | 5 | B | 10 | Pangkat dua",
    "mc | Mana yang termasuk tipe data Python? | int | str | list | loop | A;B;C | 15 | loop bukan tipe",
    "tf | Markdown dapat memuat blok kode dengan ```. | | | | | benar | 5 |",
    "essay | Jelaskan beda list dan tuple di Python. | | | | | | 20 | Sebutkan mutability + contoh",
    "",
  ].join("\n");
}

/** key huruf → nilai opsi (mis. B → options[1]). Multi mc mengembalikan array. */
export function mapChoiceKey(
  key: string,
  type: PackQuestionType,
  options: string[],
): { id: string; ids: string[] } {
  if (type === "multiple_choice") {
    const ids = key
      .split(/[;,]/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .map((k) => options[LETTERS.indexOf(k)] ?? "")
      .filter(Boolean);
    return { id: "", ids };
  }
  const k = key.trim().toUpperCase();
  const idx = LETTERS.indexOf(k);
  return { id: idx >= 0 && idx < options.length ? (options[idx] ?? "") : "", ids: [] };
}
