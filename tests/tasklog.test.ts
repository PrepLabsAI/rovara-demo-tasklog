import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonStore, emptyState } from "../src/storage";
import { add, done, list } from "../src/tasks";
import { report } from "../src/report";
import { formatTasks, formatReport, formatReportCsv } from "../src/format";
import { normalize, positiveId, validateState } from "../src/validation";
import { parseArgs } from "../src/args";
import { run, HELP } from "../src/commands";
const dirs: string[] = [];
function directory() {
  const d = mkdtempSync(join(tmpdir(), "tasklog-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});
describe("tasks", () => {
  it("assigns durable IDs and trims input", () => {
    const s = emptyState();
    expect(add(s, { title: "  Pack samples  " }).id).toBe(1);
    expect(add(s, { title: "Ship", project: "demo", minutes: 20 }).id).toBe(2);
    expect(s.tasks[0].title).toBe("Pack samples");
    expect(list(s, { project: "demo" })).toHaveLength(1);
    expect(list(s, { project: "other" })).toHaveLength(0);
  });
  it("completes once and filters status", () => {
    const s = emptyState();
    add(s, { title: "A" });
    add(s, { title: "B" });
    done(s, 1, new Date("2026-01-02T12:00:00Z"));
    done(s, 1, new Date("2026-01-03T12:00:00Z"));
    expect(s.tasks[0].completedAt).toBe("2026-01-02T12:00:00.000Z");
    expect(list(s, { status: "done" }).map((t) => t.id)).toEqual([1]);
    expect(list(s, { status: "open" }).map((t) => t.id)).toEqual([2]);
    expect(() => done(s, 99)).toThrow("not found");
  });
  it.each(["", " ".repeat(3), "a".repeat(121)])(
    "rejects invalid title %j",
    (title) => {
      expect(() => normalize({ title })).toThrow("Title");
    },
  );
  it.each([-1, 1.5, 1441, NaN])("rejects minutes %j", (minutes) => {
    expect(() => normalize({ title: "A", minutes })).toThrow("Minutes");
  });
  it("rejects invalid project and IDs", () => {
    expect(() => normalize({ title: "A", project: "../oops" })).toThrow(
      "project",
    );
    expect(positiveId("12")).toBe(12);
    for (const id of ["0", "-2", "1.2", "1e2", "abc"])
      expect(() => positiveId(id)).toThrow("ID");
  });
});
describe("storage", () => {
  it("persists and reloads without changing state", () => {
    const store = new JsonStore(join(directory(), "nested"));
    const s = store.load();
    add(s, { title: "A" });
    store.save(s);
    expect(store.load()).toEqual(s);
    expect(readFileSync(store.file, "utf8")).toContain('"version": 1');
  });
  it("refuses malformed JSON and invalid schemas", () => {
    const store = new JsonStore(directory());
    writeFileSync(store.file, "{");
    expect(() => store.load()).toThrow();
    for (const value of [
      null,
      {},
      { version: 2 },
      { version: 1, nextId: 1, tasks: [{}] },
    ]) {
      expect(() => validateState(value)).toThrow("Invalid storage");
    }
    const s = emptyState();
    add(s, { title: "A" });
    s.nextId = 1;
    expect(() => validateState(s)).toThrow();
  });
});
describe("report and formatting", () => {
  it("groups completed work in UTC over inclusive dates", () => {
    const s = emptyState();
    add(s, { title: "A", project: "z", minutes: 15 });
    add(s, { title: "B", project: "a", minutes: 5 });
    add(s, { title: "C", project: "a", minutes: 10 });
    s.tasks.forEach((t) => done(s, t.id, new Date("2026-01-02T00:00:00Z")));
    expect(report(s)).toEqual([
      { project: "a", tasks: 2, minutes: 15 },
      { project: "z", tasks: 1, minutes: 15 },
    ]);
    expect(report(s, "2026-01-03")).toEqual([]);
    expect(report(s, undefined, "2026-01-01")).toEqual([]);
    expect(report(s, "2026-01-02", "2026-01-02")).toHaveLength(2);
    expect(formatReport(report(s))).toContain("a: 2 tasks, 15m");
  });
  it("formatReportCsv: header + rows", () => {
    const rows = [
      { project: "beta", tasks: 1, minutes: 30 },
      { project: "alpha", tasks: 3, minutes: 120 },
    ];
    const out = formatReportCsv(rows);
    expect(out).toBe("project,tasks,minutes\nbeta,1,30\nalpha,3,120");
  });
  it("formatReportCsv: empty rows yield header only", () => {
    expect(formatReportCsv([])).toBe("project,tasks,minutes");
  });
  it("formatReportCsv: quotes project containing a comma", () => {
    expect(formatReportCsv([{ project: "a,b", tasks: 1, minutes: 5 }])).toBe(
      'project,tasks,minutes\n"a,b",1,5',
    );
  });
  it("formatReportCsv: quotes project starting with formula-injection character", () => {
    expect(formatReportCsv([{ project: "=evil", tasks: 1, minutes: 0 }])).toBe(
      'project,tasks,minutes\n"=evil",1,0',
    );
    expect(formatReportCsv([{ project: "+add", tasks: 1, minutes: 0 }])).toBe(
      'project,tasks,minutes\n"+add",1,0',
    );
    expect(formatReportCsv([{ project: "-sub", tasks: 1, minutes: 0 }])).toBe(
      'project,tasks,minutes\n"-sub",1,0',
    );
    expect(formatReportCsv([{ project: "@ref", tasks: 1, minutes: 0 }])).toBe(
      'project,tasks,minutes\n"@ref",1,0',
    );
  });
  it("formatReportCsv: doubles embedded double-quotes in project", () => {
    expect(formatReportCsv([{ project: 'say"hi', tasks: 1, minutes: 0 }])).toBe(
      'project,tasks,minutes\n"say""hi",1,0',
    );
  });
  it("formatReportCsv: safe slugs are not quoted", () => {
    expect(formatReportCsv([{ project: "my-project", tasks: 2, minutes: 30 }])).toBe(
      "project,tasks,minutes\nmy-project,2,30",
    );
  });
  it("report --format csv combined with date filters", () => {
    const s = emptyState();
    add(s, { title: "A", project: "p", minutes: 10 });
    done(s, 1, new Date("2026-03-01T00:00:00Z"));
    const rows = report(s, "2026-03-01", "2026-03-01");
    expect(formatReportCsv(rows)).toBe("project,tasks,minutes\np,1,10");
    expect(formatReportCsv(report(s, "2026-03-02"))).toBe("project,tasks,minutes");
  });
  it("handles no work and bad ranges", () => {
    const s = emptyState();
    add(s, { title: "Open" });
    expect(report(s)).toEqual([]);
    expect(formatReport([])).toBe("No completed work.");
    expect(formatTasks([])).toBe("No tasks found.");
    expect(formatTasks(s.tasks)).toContain("[ ] Open");
    done(s, 1);
    expect(formatTasks(s.tasks)).toContain("[x]");
    expect(() => report(s, "yesterday")).toThrow("YYYY");
    expect(() => report(s, undefined, "later")).toThrow("YYYY");
    expect(() => report(s, "2026-02-02", "2026-01-01")).toThrow("precede");
  });
});
describe("commands", () => {
  it("supports a complete persistent CLI session", () => {
    const dir = directory();
    expect(run([], dir)).toBe(HELP);
    expect(
      run(
        ["add", "Pack", "samples", "--project", "demo", "--minutes", "12"],
        dir,
      ),
    ).toBe("Added task 1.");
    expect(run(["list", "--status", "open"], dir)).toContain("Pack samples");
    expect(run(["done", "1"], dir)).toBe("Completed task 1.");
    expect(run(["report"], dir)).toContain("12m");
    expect(run(["add", "Next"], dir)).toBe("Added task 2.");
    expect(run(["list", "--data-dir", dir], "unused")).toContain("Next");
  });
  it("reports invalid inputs without writes", () => {
    const dir = directory();
    for (const args of [
      ["add"],
      ["done"],
      ["done", "1", "2"],
      ["list", "--status", "bad"],
      ["wat"],
    ]) {
      expect(() => run(args, dir)).toThrow();
    }
    expect(new JsonStore(dir).load()).toEqual(emptyState());
  });
  it("report --format csv via run()", () => {
    const dir = directory();
    run(["add", "T", "--project", "acme", "--minutes", "5"], dir);
    run(["done", "1"], dir);
    const out = run(["report", "--format", "csv"], dir);
    expect(out).toBe("project,tasks,minutes\nacme,1,5");
  });
  it("report --format text explicit equals default", () => {
    const dir = directory();
    run(["add", "T", "--project", "acme", "--minutes", "5"], dir);
    run(["done", "1"], dir);
    expect(run(["report", "--format", "text"], dir)).toBe(run(["report"], dir));
  });
  it("report --format with invalid value throws", () => {
    expect(() => run(["report", "--format", "json"], directory())).toThrow("Invalid format");
    expect(() => run(["report", "--format", "CSV"], directory())).toThrow("Invalid format");
    expect(() => run(["report", "--format", " csv"], directory())).toThrow("Invalid format");
  });
  it("--format flag without a value is rejected by parseArgs", () => {
    expect(() => parseArgs(["report", "--format"])).toThrow();
    expect(() => parseArgs(["report", "--format", "--from"])).toThrow();
  });
  it("rejects missing, repeated and unknown flags", () => {
    for (const args of [
      ["list", "--wat", "a"],
      ["list", "--project"],
      ["list", "--project", "--minutes"],
      ["list", "--project", "a", "--project", "b"],
    ])
      expect(() => parseArgs(args)).toThrow();
    expect(parseArgs([]).command).toBe("help");
  });
});
