import { parseArgs } from "./args";
import { JsonStore } from "./storage";
import { add, done, list } from "./tasks";
import { report } from "./report";
import { formatReport, formatReportCsv, formatTasks } from "./format";
import { positiveId } from "./validation";
import type { ListOptions } from "./types";
export const HELP =
  "Commands: add <title>, list, done <id>, report. Options: --data-dir, --project, --minutes, --status, --from, --to";
export function run(args: string[], defaultDirectory: string): string {
  const { command, values, flags } = parseArgs(args);
  if (command === "help") return HELP;
  const store = new JsonStore(flags["data-dir"] ?? defaultDirectory);
  const state = store.load();
  switch (command) {
    case "add": {
      if (!values.length) throw new Error("A title is required");
      const task = add(state, {
        title: values.join(" "),
        project: flags.project,
        minutes: flags.minutes === undefined ? 0 : Number(flags.minutes),
      });
      store.save(state);
      return `Added task ${task.id}.`;
    }
    case "list": {
      const status = flags.status ?? "all";
      if (!["all", "open", "done"].includes(status))
        throw new Error("Invalid status");
      return formatTasks(
        list(state, {
          status: status as ListOptions["status"],
          project: flags.project,
        }),
      );
    }
    case "done": {
      if (values.length !== 1) throw new Error("One task ID is required");
      const task = done(state, positiveId(values[0]));
      store.save(state);
      return `Completed task ${task.id}.`;
    }
    case "report": {
      const fmt = flags.format ?? "text";
      if (fmt !== "text" && fmt !== "csv") throw new Error("Invalid format");
      const rows = report(state, flags.from, flags.to);
      return fmt === "csv" ? formatReportCsv(rows) : formatReport(rows);
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
