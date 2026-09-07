import { describe, expect, it } from "vitest";
import { CERTIFICATES_BUCKET, certificateObjectName } from "@/lib/certificate-store";

describe("certificate-store path sanitization", () => {
  it("maps a server-generated public_id to {id}.pdf deterministically", () => {
    expect(certificateObjectName("b452443196874056bd527530b4cf3138")).toBe(
      "b452443196874056bd527530b4cf3138.pdf",
    );
    expect(certificateObjectName("  B452443196874056BD527530B4CF3138 ")).toBe(
      "b452443196874056bd527530b4cf3138.pdf",
    );
  });

  it("allows demo slugs (lowercase letters, digits, hyphens)", () => {
    expect(certificateObjectName("demo-valid-certificate")).toBe("demo-valid-certificate.pdf");
  });

  it("rejects traversal and hostile characters", () => {
    for (const bad of [
      "../certificates/x",
      "..%2fx",
      "a/b",
      "a\\b",
      "a b",
      "a?b",
      "a#b",
      "",
      ".",
      "..",
      "a..b",
    ]) {
      expect(() => certificateObjectName(bad)).toThrow("INVALID_PUBLIC_ID");
    }
  });

  it("persists to the private certificates bucket", () => {
    expect(CERTIFICATES_BUCKET).toBe("certificates");
  });
});
