// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadLocalPref, saveLocalPref } from "@/lib/client-storage";

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("client-storage (pref authoring AI)", () => {
  it("menyimpan & membaca string/number dengan prefix", () => {
    saveLocalPref("ai:pack-topic", "Perulangan Python");
    saveLocalPref("ai:pack-count", 5);
    expect(loadLocalPref<string>("ai:pack-topic")).toBe("Perulangan Python");
    expect(loadLocalPref<number>("ai:pack-count")).toBe(5);
    expect(window.localStorage.getItem("lms-ui:ai:pack-topic")).toBe('"Perulangan Python"');
  });

  it("nilai null menghapus pref", () => {
    saveLocalPref("ai:article-topic", "Perulangan for");
    saveLocalPref("ai:article-topic", null);
    expect(loadLocalPref<string>("ai:article-topic")).toBeNull();
    expect(window.localStorage.getItem("lms-ui:ai:article-topic")).toBeNull();
  });

  it("data rusak → null, tidak melempar", () => {
    window.localStorage.setItem("lms-ui:ai:pack-count", "{not json");
    expect(loadLocalPref<number>("ai:pack-count")).toBeNull();
    saveLocalPref("ai:pack-count", 8);
    expect(loadLocalPref<number>("ai:pack-count")).toBe(8);
  });
});
