import type { AddInput, ListOptions, State, Task } from "./types";
import { normalize } from "./validation";
export function add(state: State, input: AddInput, now = new Date()): Task {
  const fields = normalize(input);
  const task: Task = {
    ...fields,
    id: state.nextId++,
    createdAt: now.toISOString(),
    completedAt: null,
  };
  state.tasks.push(task);
  return task;
}
export function list(state: State, options: ListOptions = {}): Task[] {
  return state.tasks
    .filter((task) => {
      if (options.project && task.project !== options.project) return false;
      if (options.status === "open") return task.completedAt === null;
      if (options.status === "done") return task.completedAt !== null;
      return true;
    })
    .sort((a, b) => a.id - b.id)
    .slice(0, options.limit);
}
export function done(state: State, id: number, now = new Date()): Task {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Task ${id} not found`);
  if (task.completedAt === null) task.completedAt = now.toISOString();
  return task;
}
