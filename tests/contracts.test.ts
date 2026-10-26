import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { run } from '../src/commands';
import { JsonStore, emptyState } from '../src/storage';
import { validateState } from '../src/validation';
import { add, done } from '../src/tasks';
import { report } from '../src/report';

const directories: string[] = [];
function directory() {
  const path = mkdtempSync(join(tmpdir(), 'tasklog-contract-'));
  directories.push(path);
  return path;
}
afterEach(() => {
  for (const path of directories.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe('storage contracts', () => {
  it('keeps a corrupt document byte-for-byte after a failed command', () => {
    const path = directory();
    const store = new JsonStore(path);
    writeFileSync(store.file, '{ broken fixture');
    expect(() => run(['add', 'A'], path)).toThrow();
    expect(readFileSync(store.file, 'utf8')).toBe('{ broken fixture');
  });

  it('does not consume IDs when input validation fails', () => {
    const state = emptyState();
    expect(() => add(state, { title: ' ' })).toThrow();
    expect(state.nextId).toBe(1);
    expect(state.tasks).toEqual([]);
    expect(add(state, { title: 'Valid' }).id).toBe(1);
  });

  it('preserves metadata and timestamps through a save/load round trip', () => {
    const store = new JsonStore(directory());
    const state = emptyState();
    add(state, { title: 'Pack', project: 'north', minutes: 40 }, new Date('2026-02-02T10:30:00Z'));
    done(state, 1, new Date('2026-02-03T11:00:00Z'));
    store.save(state);
    expect(store.load().tasks[0]).toEqual({
      id: 1,
      title: 'Pack',
      project: 'north',
      minutes: 40,
      createdAt: '2026-02-02T10:30:00.000Z',
      completedAt: '2026-02-03T11:00:00.000Z',
    });
  });

  it('rejects duplicate IDs even with a plausible nextId', () => {
    const state = emptyState();
    add(state, { title: 'A' });
    state.tasks.push({ ...state.tasks[0] });
    expect(() => validateState(state)).toThrow('Invalid storage document');
  });

  it('rejects invalid persisted timestamps', () => {
    const state = emptyState();
    add(state, { title: 'A' });
    state.tasks[0].createdAt = 'not-a-date';
    expect(() => validateState(state)).toThrow();
    state.tasks[0].createdAt = '2026-01-01T00:00:00Z';
    state.tasks[0].completedAt = 'not-a-date';
    expect(() => validateState(state)).toThrow();
  });
});

describe('report contracts', () => {
  it('excludes open tasks even if their creation falls in the range', () => {
    const state = emptyState();
    add(state, { title: 'Open', minutes: 90 }, new Date('2026-01-01T00:00:00Z'));
    expect(report(state, '2026-01-01', '2026-01-31')).toEqual([]);
  });

  it('uses completion day rather than creation day', () => {
    const state = emptyState();
    add(state, { title: 'Pack', minutes: 25 }, new Date('2025-12-31T23:00:00Z'));
    done(state, 1, new Date('2026-01-02T00:10:00Z'));
    expect(report(state, '2025-12-31', '2025-12-31')).toEqual([]);
    expect(report(state, '2026-01-02', '2026-01-02')).toEqual([
      { project: 'general', tasks: 1, minutes: 25 },
    ]);
  });

  it('includes zero-minute completed work in the task count', () => {
    const state = emptyState();
    add(state, { title: 'Quick check' });
    done(state, 1);
    expect(report(state)).toEqual([{ project: 'general', tasks: 1, minutes: 0 }]);
  });

  it('does not mutate task order while grouping projects', () => {
    const state = emptyState();
    add(state, { title: 'Z', project: 'z' });
    add(state, { title: 'A', project: 'a' });
    done(state, 1);
    done(state, 2);
    const before = JSON.stringify(state);
    expect(report(state).map(row => row.project)).toEqual(['a', 'z']);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('CLI process boundary', () => {
  function cli(args: string[], cwd: string) {
    return spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args, '--data-dir', cwd], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
  }

  it('writes successful output to stdout and exits zero', () => {
    const path = directory();
    const created = cli(['add', 'Pack samples'], path);
    expect(created.status).toBe(0);
    expect(created.stdout).toBe('Added task 1.\n');
    expect(created.stderr).toBe('');
    const listed = cli(['list'], path);
    expect(listed.status).toBe(0);
    expect(listed.stdout).toContain('Pack samples');
  });

  it('writes a helpful error to stderr and exits one', () => {
    const result = cli(['done', '99'], directory());
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Task 99 not found');
  });

  it('isolates data directories', () => {
    const first = directory();
    const second = directory();
    run(['add', 'Only here'], first);
    expect(run(['list'], second)).toBe('No tasks found.');
    expect(run(['list'], first)).toContain('Only here');
  });
});
