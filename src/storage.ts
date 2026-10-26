import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateState } from "./validation";
import type { State } from "./types";
export function emptyState(): State {
  return { version: 1, nextId: 1, tasks: [] };
}
export class JsonStore {
  readonly file: string;
  constructor(directory: string) {
    this.file = join(directory, "tasks.json");
  }
  load(): State {
    let content: string;
    try {
      content = readFileSync(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyState();
      throw error;
    }
    return validateState(JSON.parse(content));
  }
  save(state: State): void {
    validateState(state);
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, JSON.stringify(state, null, 2) + "\n", {
      mode: 0o600,
    });
    renameSync(temporary, this.file);
  }
}
// TODO: support cooperating writers with a lock before using this on shared drives.
