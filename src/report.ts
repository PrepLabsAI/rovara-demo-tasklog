import type { ProjectSummary, State } from "./types";
export function report(
  state: State,
  from?: string,
  to?: string,
): ProjectSummary[] {
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from))
    throw new Error("Use YYYY-MM-DD");
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Use YYYY-MM-DD");
  if (from && to && from > to) throw new Error("Start must precede end");
  const groups = new Map<string, ProjectSummary>();
  for (const task of state.tasks) {
    if (!task.completedAt) continue;
    const day = task.completedAt.slice(0, 10);
    if ((from && day < from) || (to && day > to)) continue;
    const row = groups.get(task.project) ?? {
      project: task.project,
      tasks: 0,
      minutes: 0,
    };
    row.tasks += 1;
    row.minutes += task.minutes;
    groups.set(task.project, row);
  }
  return [...groups.values()].sort((a, b) =>
    a.project.localeCompare(b.project),
  );
}
