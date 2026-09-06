import { describe, expect, it } from "vitest";
import { bottleneckAnalysis, buildTeacherDigest } from "@/lib/analytics-teacher";

describe("bottleneckAnalysis — hambatan jalur belajar", () => {
  const lessons = [
    { id: "L1", title: "Variabel" },
    { id: "L2", title: "Percabangan" },
    { id: "L3", title: "Perulangan" },
  ];
  const opened = [
    { lessonId: "L1", enrollmentId: "E1" },
    { lessonId: "L1", enrollmentId: "E2" },
    { lessonId: "L1", enrollmentId: "E3" },
    { lessonId: "L1", enrollmentId: "E4" },
    { lessonId: "L2", enrollmentId: "E1" },
    { lessonId: "L2", enrollmentId: "E2" },
    { lessonId: "L2", enrollmentId: "E3" },
    { lessonId: "L3", enrollmentId: "E1" },
  ];
  const completed = [
    { lessonId: "L1", enrollmentId: "E1" },
    { lessonId: "L1", enrollmentId: "E2" },
  ];

  it("dropoff = 1 − selesai/mulai; L1 2/4 = 50%, L2 0/3 = 100%, L3 0/1", () => {
    const rows = bottleneckAnalysis(lessons, opened, completed);
    const byId = new Map(rows.map((r) => [r.lessonId, r]));
    expect(byId.get("L1")).toMatchObject({ opened: 4, completed: 2, dropoff: 0.5, severity: "high" });
    expect(byId.get("L2")).toMatchObject({ opened: 3, completed: 0, dropoff: 1, severity: "high" });
    expect(byId.get("L3")).toMatchObject({ opened: 1, completed: 0, severity: "insufficient" });
  });

  it("urutan deterministik: dropoff turun, lalu opened turun, lalu judul", () => {
    const rows = bottleneckAnalysis(lessons, opened, completed);
    expect(rows.map((r) => r.lessonId)).toEqual(["L2", "L3", "L1"]);
    // Panggilan kedua sama persis.
    expect(bottleneckAnalysis(lessons, opened, completed).map((r) => r.lessonId)).toEqual(["L2", "L3", "L1"]);
  });

  it("enrollment duplikat tidak menggandakan hitungan (distinct)", () => {
    const dupOpened = [...opened, { lessonId: "L1", enrollmentId: "E1" }];
    const rows = bottleneckAnalysis(lessons, dupOpened, completed);
    expect(rows.find((r) => r.lessonId === "L1")?.opened).toBe(4);
  });

  it("lesson tanpa dibuka → dropoff null, insufficient (n < minN)", () => {
    const rows = bottleneckAnalysis([{ id: "LX", title: "X" }], [], []);
    expect(rows[0]).toMatchObject({ opened: 0, completed: 0, dropoff: null, severity: "insufficient" });
  });
});

describe("buildTeacherDigest — tiga prioritas tindakan", () => {
  it("semua sinyal → 3 item urut prioritas dengan alasan", () => {
    const digest = buildTeacherDigest({
      pendingGrading: 4,
      openAlerts: [
        { id: "a1", message: "Murid tidak aktif", createdAt: "2026-09-01T00:00:00Z", status: "open" },
        { id: "a2", message: "Attempt berulang", createdAt: "2026-09-02T00:00:00Z", status: "snoozed" },
      ],
      inactiveStudents: [{ studentId: "S1", displayName: "Andi", lastActivityAt: null }],
    });
    expect(digest).toHaveLength(3);
    expect(digest.map((d) => d.priority)).toEqual([1, 2, 3]);
    expect(digest[0]?.id).toBe("digest-pending-grading");
    expect(digest[1]?.id).toBe("digest-alerts");
    expect(digest[2]?.id).toBe("digest-inactive");
    expect(digest[0]?.reason).toContain("4");
  });

  it("banyak peringatan (≥5) menaikkan prioritas alerts ke 1", () => {
    const digest = buildTeacherDigest({
      pendingGrading: 0,
      openAlerts: [1, 2, 3, 4, 5].map((i) => ({
        id: `a${i}`,
        message: `alert ${i}`,
        createdAt: `2026-09-0${i}T00:00:00Z`,
        status: "open",
      })),
      inactiveStudents: [],
    });
    expect(digest[0]?.id).toBe("digest-alerts");
    expect(digest[0]?.priority).toBe(1);
  });

  it("status resolved tidak dihitung sebagai peringatan terbuka", () => {
    const digest = buildTeacherDigest({
      pendingGrading: 0,
      openAlerts: [
        { id: "a1", message: "lama", createdAt: "2026-09-01T00:00:00Z", status: "resolved" },
        { id: "a2", message: "aktif", createdAt: "2026-09-02T00:00:00Z", status: "open" },
      ],
      inactiveStudents: [],
    });
    expect(digest.find((d) => d.id === "digest-alerts")?.title).toContain("1");
  });

  it("semua bersih → satu item 'tidak ada tindakan mendesak'", () => {
    const digest = buildTeacherDigest({ pendingGrading: 0, openAlerts: [], inactiveStudents: [] });
    expect(digest).toHaveLength(1);
    expect(digest[0]?.id).toBe("digest-clear");
  });

  it("deterministik: dua panggilan identik", () => {
    const input = {
      pendingGrading: 2,
      openAlerts: [{ id: "a", message: "m", createdAt: "2026-09-01T00:00:00Z", status: "open" }],
      inactiveStudents: [{ studentId: "S", displayName: "B", lastActivityAt: null }],
      now: new Date("2026-09-06T00:00:00Z"),
    };
    expect(buildTeacherDigest(input)).toEqual(buildTeacherDigest(input));
  });
});
