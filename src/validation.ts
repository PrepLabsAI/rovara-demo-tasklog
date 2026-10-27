import type { AddInput, State, Task } from "./types";
export function title(value: string): string {
  const result = value.trim();
  if (!result || result.length > 120)
    throw new Error("Title must contain 1–120 characters");
  return result;
}
export function project(value = "general"): string {
  const result = value.trim();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(result))
    throw new Error("Invalid project slug");
  return result;
}
export function minutes(value = 0): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1440) {
    throw new Error("Minutes must be an integer between 0 and 1440");
  }
  return value;
}
export function normalize(input: AddInput): Required<AddInput> {
  return {
    title: title(input.title),
    project: project(input.project),
    minutes: minutes(input.minutes),
  };
}
export function positiveId(value: string): number {
  const result = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(result) || result < 1)
    throw new Error("Invalid task ID");
  return result;
}
export function limitN(value: string): number {
  if (!/^\d+$/.test(value))
    throw new Error("Limit must be an integer between 1 and 100");
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100)
    throw new Error("Limit must be an integer between 1 and 100");
  return n;
}
function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const t = value as Task;
  return (
    Number.isSafeInteger(t.id) &&
    t.id > 0 &&
    typeof t.title === "string" &&
    typeof t.project === "string" &&
    Number.isInteger(t.minutes) &&
    t.minutes >= 0 &&
    typeof t.createdAt === "string" &&
    Number.isFinite(Date.parse(t.createdAt)) &&
    (t.completedAt === null ||
      (typeof t.completedAt === "string" &&
        Number.isFinite(Date.parse(t.completedAt))))
  );
}
export function validateState(value: unknown): State {
  if (!value || typeof value !== "object")
    throw new Error("Invalid storage document");
  const s = value as State;
  if (
    s.version !== 1 ||
    !Number.isSafeInteger(s.nextId) ||
    s.nextId < 1 ||
    !Array.isArray(s.tasks) ||
    !s.tasks.every(isTask) ||
    new Set(s.tasks.map((t) => t.id)).size !== s.tasks.length ||
    s.tasks.some((t) => t.id >= s.nextId)
  )
    throw new Error("Invalid storage document");
  return s;
}
