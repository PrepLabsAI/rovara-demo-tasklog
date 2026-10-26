import type { ProjectSummary, Task } from "./types";
export const EMPTY_MESSAGE = "No tasks found.";
export function formatTasks(tasks: Task[]): string {
  if (!tasks.length) return EMPTY_MESSAGE;
  return tasks
    .map(
      (t) =>
        `${t.id} [${t.completedAt ? "x" : " "}] ${t.title} (${t.project}, ${t.minutes}m)`,
    )
    .join("\n");
}
export function formatReport(rows: ProjectSummary[]): string {
  if (!rows.length) return "No completed work.";
  return rows
    .map((r) => `${r.project}: ${r.tasks} tasks, ${r.minutes}m`)
    .join("\n");
}
