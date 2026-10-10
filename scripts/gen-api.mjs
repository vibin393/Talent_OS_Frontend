// Generates src/lib/api/schema.d.ts from the backend OpenAPI document.
// Usage: npm run gen:api  (BACKEND_URL defaults to http://127.0.0.1:8000)
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const backend = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const source = `${backend}/openapi.json`;

// Run the locally installed CLI with node directly: no shell, so BACKEND_URL is never shell-parsed.
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("openapi-typescript/package.json")), "bin", "cli.js");
const result = spawnSync(process.execPath, [cli, source, "-o", "src/lib/api/schema.d.ts"], { stdio: "inherit" });

if (result.error) {
  console.error(`gen:api failed to start openapi-typescript: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`gen:api failed (exit ${result.status ?? "signal " + result.signal}) reading ${source}`);
}
process.exit(result.status ?? 1);
