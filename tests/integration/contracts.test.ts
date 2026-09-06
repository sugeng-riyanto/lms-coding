import { describe, expect, it } from "vitest";
import { createCourseSchema, robloxCompletionSchema, submitAttemptSchema } from "@/lib/validation";
import { isChainEnabled, NoopChainAdapter } from "@/lib/chain";

describe("boundary validation (Zod)", () => {
  it("menolak slug jahat", () => {
    expect(createCourseSchema.safeParse({ slug: "OK BOS", title: "x" }).success).toBe(false);
    expect(createCourseSchema.safeParse({ slug: "matematika-dasar", title: "Matematika" }).success).toBe(
      true,
    );
  });
  it("submit attempt butuh idempotency key", () => {
    expect(submitAttemptSchema.safeParse({ attemptId: "not-uuid", idempotencyKey: "x" }).success).toBe(false);
  });
  it("roblox payload ditolak tanpa signature", () => {
    expect(
      robloxCompletionSchema.safeParse({
        event_id: "e",
        place_id: "p",
        roblox_user_id: "r",
        challenge_id: "d0000000-0000-0000-0000-000000000001",
        score: 90,
        issued_at: new Date().toISOString(),
        nonce: "1234567890123456",
      }).success,
    ).toBe(false);
  });
});

describe("chain adapter default OFF, tanpa klaim palsu", () => {
  it("noop saat flag off", async () => {
    process.env.BLOCKCHAIN_ANCHOR_ENABLED = "false";
    expect(isChainEnabled()).toBe(false);
    const r = await new NoopChainAdapter().anchor("abc");
    expect(r.status).toBe("not_configured");
  });
});
