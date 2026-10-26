# Tasklog

A single-user local task and time ledger for small project teams. All examples use fake data.

## Run

Node 22. `npm ci`, then `npm start -- help`.

```sh
npm start -- add "Pack sample box" --project samples --minutes 25
npm start -- list --status open
npm start -- done 1
npm start -- report --from 2026-01-01 --to 2026-12-31
```

Data lives in `.tasklog/tasks.json` relative to your working directory. Override with
`--data-dir ./sample-data`. A title is 1–120 characters, project is a lowercase slug,
and minutes is an integer 0–1440. IDs increase monotonically. Completing a task twice
preserves the first completion timestamp. Reports include completed tasks only,
group by project, and use UTC dates with inclusive boundaries.

## Development

`npm run lint` checks ESLint and TypeScript. `npm test` runs Vitest and enforces 70%
coverage across statements, branches, functions and lines. CI executes these same
commands after `npm ci`. Storage writes use a temporary file plus rename; concurrent
writers are not supported. The command dispatcher intentionally owns persistence and
presentation together; keep changes small until a second interface needs extraction.

JSON documents have `version`, `nextId`, and `tasks`. Invalid input or corrupt storage
fails without overwriting the existing document. Back up data before manual edits.
No network connection is needed at runtime. MIT licensed.
