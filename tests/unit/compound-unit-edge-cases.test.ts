import { describe, expect, it } from "vitest";
import { parseNumericAnswer } from "@/lib/grading";

const U = { expectedUnit: "m/s", unitFactors: { m: 1, km: 1000, s: 1 } };

describe("compound-unit edge cases — parser acceptance behaviour", () => {
  // ── Angka polos / kosong ──
  it("angka polos tanpa unit →返回 angka (basis)", () => {
    expect(parseNumericAnswer("5", U)).toBeCloseTo(5, 6);
    expect(parseNumericAnswer("5 ", U)).toBeCloseTo(5, 6);
    expect(parseNumericAnswer(" 5", U)).toBeCloseTo(5, 6);
  });

  it("string kosong / whitespace-only → null", () => {
    expect(parseNumericAnswer("", U)).toBeNull();
    expect(parseNumericAnswer("   ", U)).toBeNull();
  });

  it("hanya unit tanpa angka → null (regex tak match)", () => {
    expect(parseNumericAnswer("m/s", U)).toBeNull();
    expect(parseNumericAnswer("km/jam", U)).toBeNull();
  });

  // ── Operator di posisi leading / trailing ──
  it("leading slash diterima — /s = s⁻¹ (faktor 1⁻¹ = 1)", () => {
    // Parser menganggap "/" sebelum token pertama sebagai pembalik (pembilang kosong).
    // Secara struktural valid: m token dikenal, gap "/" diperbolehkan.
    expect(parseNumericAnswer("5 /s", U)).toBeCloseTo(5, 6);
  });

  it("trailing slash diterima — m/ = m (sisa '/' di akhir gap valid)", () => {
    expect(parseNumericAnswer("5 m/", U)).toBeCloseTo(5, 6);
  });

  it("trailing multiply diterima — m/s* = m/s (sisa '*' di akhir gap valid)", () => {
    expect(parseNumericAnswer("5 m/s*", U)).toBeCloseTo(5, 6);
  });

  it("leading multiply diterima — *m/s = m/s (gap '*' valid)", () => {
    expect(parseNumericAnswer("5 *m/s", U)).toBeCloseTo(5, 6);
  });

  // ── Operator berulang ──
  it("'m//s' diterima — dua '/' = genap = pembilang (s^+1, bukan s⁻¹)", () => {
    // Dua slash membalik dua kali → kembali ke pembilang. Struktural gap valid.
    expect(parseNumericAnswer("5 m//s", U)).toBeCloseTo(5, 6);
  });

  it("'m * * s' diterima — gap ' * * ' hanya spasi+*, valid", () => {
    expect(parseNumericAnswer("5 m * * s", U)).toBeCloseTo(5, 6);
  });

  // ── Space sebagai pemisah ──
  it("'m s' diterima — spasi valid di ALLOWED_GAP", () => {
    // Spasi diperbolehkan di antara token (parser memperlakukan spasi sebagai operator).
    expect(parseNumericAnswer("5 m s", U)).toBeCloseTo(5, 6);
  });

  // ── Token bertumpuk tanpa pemisah ──
  it("'m/s²m' diterima — 'm'+'/'+'s²'+'m', gap kosong antara s² dan m valid", () => {
    // s² + m tanpa pemisah: gap="" lolos ALLOWED_GAP → m * s⁻² * m = m² * s⁻².
    // Ini merupakan limitasi parser — token berurutan tanpa operator diterima.
    expect(parseNumericAnswer("5 m/s²m", U)).toBeCloseTo(5, 6);
  });

  it("'m*m' diterima — gap '*' antara dua token 'm' valid", () => {
    // m * m → m² (m^1 * m^1). Struktural valid meski tidak biasa.
    expect(parseNumericAnswer("5 m*m", U)).toBeCloseTo(5, 6);
  });

  // ── Eksponen diikuti trailing operator ──
  it("m/s^2/ diterima — trailing '/' valid", () => {
    expect(parseNumericAnswer("5 m/s^2/", U)).toBeCloseTo(5, 6);
  });

  it("m/s^2// diterima — trailing '//' valid (genap)", () => {
    expect(parseNumericAnswer("5 m/s^2//", U)).toBeCloseTo(5, 6);
  });

  // ── Rejection: karakter ilegal ──
  it("'m@jam' ditolak — karakter '@' tak dikenal", () => {
    expect(parseNumericAnswer("5 m@jam", U)).toBeNull();
  });

  it("'m+jam' ditolak — karakter '+' tak dikenal", () => {
    expect(parseNumericAnswer("5 m+jam", U)).toBeNull();
  });

  // ── Rejection: trailing caret tanpa digit ──
  it("m/s^ ditolak — '^' tanpa digit di akhir", () => {
    expect(parseNumericAnswer("5 m/s^", U)).toBeNull();
  });

  it("m/s^  ditolak — '^' + spasi tanpa digit", () => {
    expect(parseNumericAnswer("5 m/s^ ", U)).toBeNull();
  });

  it("m/s^2/^3 ditolak — '^' di gap trailing setelah slash", () => {
    // Setelah s^2, gap "/^3" mengandung '^' yang bukan operator valid → ditolak.
    expect(parseNumericAnswer("5 m/s^2/^3", U)).toBeNull();
  });

  // ── Rejection: pangkat pecahan ──
  it("m^0.5 ditolak — pangkat pecahan", () => {
    expect(parseNumericAnswer("5 m^0.5/s", U)).toBeNull();
  });

  // ── Rejection: unknown unit ──
  it("km/menit ditolak — 'menit' tak ada di unitFactors", () => {
    expect(parseNumericAnswer("5 km/menit", U)).toBeNull();
  });

  it("'kg·m/s²' ditolak — 'kg' tak ada di unitFactors U", () => {
    expect(parseNumericAnswer("1 kg·m/s²", U)).toBeNull();
  });

  // ── Superskrip diekspansi ──
  it("superskrip ² diekspansi dengan benar", () => {
    expect(parseNumericAnswer("5 m/s²", U)).toBeCloseTo(5, 6);
  });

  it("superskrip ³ diekspansi", () => {
    const U3 = { expectedUnit: "m/s³", unitFactors: { m: 1, s: 1 } };
    expect(parseNumericAnswer("5 m/s³", U3)).toBeCloseTo(5, 6);
  });

  it("superskrip ⁻¹ diekspansi", () => {
    expect(parseNumericAnswer("5 m·s⁻¹", U)).toBeCloseTo(5, 6);
  });

  // ── Non-numeric inputs ──
  it("null / undefined / boolean / object → null", () => {
    expect(parseNumericAnswer(null, U)).toBeNull();
    expect(parseNumericAnswer(undefined, U)).toBeNull();
    expect(parseNumericAnswer(true, U)).toBeNull();
    expect(parseNumericAnswer({}, U)).toBeNull();
  });

  it("Infinity / NaN → null", () => {
    expect(parseNumericAnswer(Infinity, U)).toBeNull();
    expect(parseNumericAnswer(-Infinity, U)).toBeNull();
    expect(parseNumericAnswer(NaN, U)).toBeNull();
  });

  // ── Notasi ilmiah ──
  it("notasi ilmiah dengan unit", () => {
    expect(parseNumericAnswer("1e3 m", U)).toBeCloseTo(1000, 6);
    expect(parseNumericAnswer("6.022e23 /s", U)).toBeCloseTo(6.022e23, 10);
  });

  // ── Tanpa unitFactors di rule ──
  it("angka polos tanpa rule → tetap jalan; ada unit tanpa rule → ditolak", () => {
    expect(parseNumericAnswer("42", undefined)).toBe(42);
    expect(parseNumericAnswer("42 m/s", undefined)).toBeNull();
  });
});
