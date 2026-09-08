import { describe, expect, it } from "vitest";
import { parseCspReport, redactUri } from "@/lib/csp-report";

describe("redactUri", () => {
  it("membuang query string dan hash (PII)", () => {
    expect(redactUri("https://lms.example/learn?student=9&token=secret#x")).toBe("https://lms.example/learn");
  });

  it("non-URL tetap dipotong (mis. 'inline'/'self')", () => {
    expect(redactUri("inline")).toBe("inline");
    expect(redactUri("x".repeat(500))).toHaveLength(200);
  });

  it("nilai non-string jadi string kosong", () => {
    expect(redactUri(null)).toBe("");
    expect(redactUri(42)).toBe("");
  });
});

describe("parseCspReport", () => {
  it("menolak body non-objek / tanpa csp-report", () => {
    expect(parseCspReport(null)).toBeNull();
    expect(parseCspReport("x")).toBeNull();
    expect(parseCspReport([])).toBeNull();
    expect(parseCspReport({})).toBeNull();
    expect(parseCspReport({ "csp-report": "x" })).toBeNull();
  });

  it("mengabaikan laporan tanpa effective-directive", () => {
    expect(parseCspReport({ "csp-report": { "blocked-uri": "https://x" } })).toBeNull();
  });

  it("mengekstrak laporan lengkap dengan URI ter-redaksi", () => {
    const parsed = parseCspReport({
      "csp-report": {
        disposition: "report",
        "effective-directive": "script-src-elem",
        "violated-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/a.js?session=abc",
        "document-uri": "https://lms.example/learn?q=1",
        referrer: "https://lms.example/",
        "line-number": 12,
        "column-number": 3,
        "script-sample": "alert(1); // data sensitif TIDAK boleh terekam",
      },
    });
    expect(parsed).toEqual({
      disposition: "report",
      effectiveDirective: "script-src-elem",
      violatedDirective: "script-src-elem",
      blockedUri: "https://evil.example/a.js",
      documentUri: "https://lms.example/learn",
      referrer: "https://lms.example/",
      lineNumber: 12,
      columnNumber: 3,
    });
    // script-sample sengaja TIDAK pernah diekstrak.
    expect(JSON.stringify(parsed)).not.toContain("alert(1)");
    expect(JSON.stringify(parsed)).not.toContain("script-sample");
  });

  it("disposition enforce terbaca; field nomor non-angka jadi null", () => {
    const parsed = parseCspReport({
      "csp-report": {
        disposition: "enforce",
        "effective-directive": "img-src",
        "blocked-uri": "https://x/y.png",
        "line-number": "12",
      },
    });
    expect(parsed?.disposition).toBe("enforce");
    expect(parsed?.lineNumber).toBeNull();
  });
});
