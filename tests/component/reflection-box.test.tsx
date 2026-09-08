// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReflectionBox } from "@/app/(student)/activities/[activityId]/reflection-box";

const renderBox = (props: { activityId: string; enrollmentId: string }) =>
  render(<ReflectionBox {...props} lang="id" />);

const recordLearningEvent = vi.fn();

vi.mock("@/features/actions", () => ({
  recordLearningEvent: (...args: unknown[]) => recordLearningEvent(...args),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

async function typeAndFlushDebounce(text: string) {
  const ta = screen.getByRole("textbox");
  fireEvent.change(ta, { target: { value: text } });
  await act(async () => {
    vi.advanceTimersByTime(900); // lewati debounce 800ms
  });
}

describe("ReflectionBox — autosave draft", () => {
  it("refresh recovery: draf pulih dari localStorage saat mount", () => {
    localStorage.setItem("lms-draft-act-1", "Refleksi lama tersimpan");
    renderBox({ activityId: "act-1", enrollmentId: "enr-1" });
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Refleksi lama tersimpan");
  });

  it("indikator saving → saved setelah event terkirim", async () => {
    recordLearningEvent.mockResolvedValue({ ok: true });
    renderBox({ activityId: "act-1", enrollmentId: "enr-1" });
    // status awal = saving (debounce berjalan) sebelum timer maju
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Pelajaran hari ini menyenangkan" },
    });
    expect(screen.getByText("Menyimpan…")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.getByText("Tersimpan")).toBeTruthy();
    expect(recordLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "draft_saved",
        entityId: "act-1",
        metadata: { chars: 31 },
      }),
    );
  });

  it("offline: draf disimpan lokal + indikator offline, tidak memanggil server", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    renderBox({ activityId: "act-1", enrollmentId: "enr-1" });
    await typeAndFlushDebounce("Tulis walau tanpa koneksi");
    expect(screen.getByText(/Offline — draf tersimpan lokal/)).toBeTruthy();
    expect(recordLearningEvent).not.toHaveBeenCalled();
    expect(localStorage.getItem("lms-draft-act-1")).toBe("Tulis walau tanpa koneksi");
  });

  it("error: server menolak → indikator error, draf tetap aman di localStorage", async () => {
    recordLearningEvent.mockResolvedValue({ ok: false, error: "EVENT_REJECTED" });
    renderBox({ activityId: "act-1", enrollmentId: "enr-1" });
    await typeAndFlushDebounce("Draf yang harus aman");
    expect(screen.getByText(/Gagal menyimpan/)).toBeTruthy();
    expect(localStorage.getItem("lms-draft-act-1")).toBe("Draf yang harus aman");
  });

  it("draf tidak melebihi batas karakter", async () => {
    renderBox({ activityId: "act-1", enrollmentId: "enr-1" });
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "x".repeat(10_000) } });
    expect((ta as HTMLTextAreaElement).value.length).toBeLessThanOrEqual(4_000);
  });
});
