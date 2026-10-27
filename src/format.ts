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
function csvField(value: string): string {
  if (/[,"\n\r]/.test(value) || /^[-=+@]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
export function formatReportCsv(rows: ProjectSummary[]): string {
  const lines = ["project,tasks,minutes"];
  for (const r of rows) lines.push(`${csvField(r.project)},${r.tasks},${r.minutes}`);
  return lines.join("\n");
}
