export interface Parsed {
  command: string;
  values: string[];
  flags: Record<string, string>;
}
const allowed = new Set([
  "project",
  "minutes",
  "status",
  "from",
  "to",
  "data-dir",
  "limit",
]);
export function parseArgs(args: string[]): Parsed {
  const [command = "help", ...rest] = args;
  const parsed: Parsed = { command, values: [], flags: {} };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--")) {
      parsed.values.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (!allowed.has(key)) throw new Error(`Unknown option: ${arg}`);
    const value = rest[++i];
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for ${arg}`);
    if (key in parsed.flags) throw new Error(`Repeated option: ${arg}`);
    parsed.flags[key] = value;
  }
  return parsed;
}
