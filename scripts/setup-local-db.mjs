import { spawnSync } from "node:child_process";
import { projectRoot } from "./sites-env.mjs";

if (process.argv.length !== 2) {
  throw new Error("This script only prepares the local database; it accepts no arguments.");
}

const common = [
  "--local", "--config", "wrangler.local.json", "--persist-to", ".wrangler/state",
];
for (const command of [
  ["d1", "migrations", "apply", "DB", ...common],
  ["d1", "execute", "DB", ...common, "--file", "scripts/local-development.sql"],
]) {
  const result = spawnSync(
    process.execPath,
    ["--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js", ...command],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Local D1 is ready. Start npm run dev and sign in as the synthetic local owner.");
