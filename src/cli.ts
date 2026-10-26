import { join } from "node:path";
import { run } from "./commands";
try {
  process.stdout.write(
    run(process.argv.slice(2), join(process.cwd(), ".tasklog")) + "\n",
  );
} catch (error) {
  process.stderr.write(
    (error instanceof Error ? error.message : "Unexpected error") + "\n",
  );
  process.exitCode = 1;
}
