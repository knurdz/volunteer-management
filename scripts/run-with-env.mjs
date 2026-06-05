import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-with-env.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  env: {
    ...process.env,
    FORCE_NODE_FETCH: process.env.FORCE_NODE_FETCH ?? "1",
    NODE_OPTIONS: [
      process.env.NODE_OPTIONS,
      "--disable-warning=DEP0205",
    ]
      .filter(Boolean)
      .join(" "),
  },
  shell: true,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
