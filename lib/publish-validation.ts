/**
 * Publish validation (Prompt 03).
 * Dijalankan SERVER-SIDE sebelum course version boleh publish.
 * Mendeteksi: objective kosong, urutan rusak, point total invalid,
 * answer key hilang, accessibility field hilang, prerequisite cycle.
 */

export type PublishIssueCode =
  | "EMPTY_OBJECTIVE"
  | "BROKEN_ORDER"
  | "INVALID_POINTS"
  | "MISSING_ANSWER_KEY"
  | "MISSING_A11Y"
  | "PREREQ_CYCLE";

export interface PublishIssue {
  code: PublishIssueCode;
  path: string;
  message: string;
}

export interface DraftActivity {
  id: string;
  position: number;
  type:
    | "article"
    | "video_link"
    | "resource"
    | "reflection"
    | "quiz"
    | "assignment_upload"
    | "roblox_challenge"
    | "code_board"
    | "embed_youtube"
    | "embed_pdf"
    | "embed_audio"
    | "embed_file"
    | "embed_web"
    | "embed_video";
  title: string;
  /** quiz: total poin + apakah setiap butir punya kunci jawaban */
  points?: number;
  hasAnswerKey?: boolean;
  /** video_link wajib punya transcript */
  transcriptAvailable?: boolean;
}

export interface DraftLesson {
  id: string;
  position: number;
  title: string;
  objective: string;
  activities: DraftActivity[];
}

export interface DraftLevel {
  id: string;
  position: number;
  title: string;
  objective: string;
  lessons: DraftLesson[];
}

export interface DraftPrereq {
  targetId: string;
  requiredIds: string[];
}

function hasCycle(allIds: string[], edges: DraftPrereq[]): string[] {
  const adj = new Map<string, string[]>(edges.map((e) => [e.targetId, e.requiredIds]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycle: string[] = [];
  const dfs = (id: string, stack: string[]): boolean => {
    if (visiting.has(id)) {
      cycle.push(...stack.slice(stack.indexOf(id)), id);
      return true;
    }
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const req of adj.get(id) ?? []) {
      if (dfs(req, [...stack, id])) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of allIds) {
    if (dfs(id, [])) break;
  }
  return cycle;
}

function checkOrder(items: { position: number }[], path: string, issues: PublishIssue[]): void {
  const positions = items.map((i) => i.position).sort((a, b) => a - b);
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] !== i) {
      issues.push({
        code: "BROKEN_ORDER",
        path,
        message: `Urutan rusak di ${path}: posisi harus 0..n tanpa lompat/duplikat.`,
      });
      return;
    }
  }
}

export function validateCourseDraft(levels: DraftLevel[], prereqs: DraftPrereq[]): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (levels.length === 0) {
    issues.push({
      code: "EMPTY_OBJECTIVE",
      path: "course",
      message: "Course tanpa level tidak bisa publish.",
    });
    return issues;
  }
  checkOrder(levels, "course.levels", issues);

  for (const level of levels) {
    const lp = `levels/${level.id}`;
    if (!level.objective.trim()) {
      issues.push({
        code: "EMPTY_OBJECTIVE",
        path: lp,
        message: `Level "${level.title}" tanpa objective terukur.`,
      });
    }
    checkOrder(level.lessons, `${lp}.lessons`, issues);
    for (const lesson of level.lessons) {
      const lep = `${lp}/lessons/${lesson.id}`;
      if (!lesson.objective.trim()) {
        issues.push({
          code: "EMPTY_OBJECTIVE",
          path: lep,
          message: `Lesson "${lesson.title}" tanpa objective.`,
        });
      }
      checkOrder(lesson.activities, `${lep}.activities`, issues);
      for (const act of lesson.activities) {
        const ap = `${lep}/activities/${act.id}`;
        if (act.type === "quiz") {
          if (act.points === undefined || act.points <= 0) {
            issues.push({
              code: "INVALID_POINTS",
              path: ap,
              message: `Quiz "${act.title}" total poin tidak valid.`,
            });
          }
          if (!act.hasAnswerKey) {
            issues.push({
              code: "MISSING_ANSWER_KEY",
              path: ap,
              message: `Quiz "${act.title}" kehilangan answer key.`,
            });
          }
        }
        if (act.type === "video_link" && !act.transcriptAvailable) {
          issues.push({ code: "MISSING_A11Y", path: ap, message: `Video "${act.title}" tanpa transcript.` });
        }
      }
    }
  }

  const allIds = new Set<string>();
  for (const l of levels) {
    allIds.add(l.id);
    for (const le of l.lessons) allIds.add(le.id);
  }
  for (const e of prereqs) {
    if (!allIds.has(e.targetId) || e.requiredIds.some((r) => !allIds.has(r))) {
      issues.push({
        code: "BROKEN_ORDER",
        path: `prereqs/${e.targetId}`,
        message: "Prerequisite merujuk entity yang tidak ada.",
      });
    }
  }
  const cycle = hasCycle([...allIds], prereqs);
  if (cycle.length > 0) {
    issues.push({
      code: "PREREQ_CYCLE",
      path: "prereqs",
      message: `Siklus prerequisite: ${cycle.join(" → ")}.`,
    });
  }
  return issues;
}
