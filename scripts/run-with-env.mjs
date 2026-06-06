import { spawnSync } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-with-env.mjs <command> [...args]");
  process.exit(1);
}

process.env.FORCE_NODE_FETCH ??= "1";
process.env.NODE_OPTIONS = [
  process.env.NODE_OPTIONS,
  "--disable-warning=DEP0205",
]
  .filter(Boolean)
  .join(" ");

const result = spawnSync(command, args, {
  shell: true,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
