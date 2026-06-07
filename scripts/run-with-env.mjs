import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-with-env.mjs <command> [...args]");
  process.exit(1);
}

function resolveCommand(rawCommand) {
  if (rawCommand === "node") {
    return { args, command: process.execPath };
  }

  const nodeEntrypoints = {
    next: path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
    vitest: path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs"),
  };
  const nodeEntrypoint = nodeEntrypoints[rawCommand];

  if (nodeEntrypoint && existsSync(nodeEntrypoint)) {
    return { args: [nodeEntrypoint, ...args], command: process.execPath };
  }

  const binaryName = process.platform === "win32" ? `${rawCommand}.exe` : rawCommand;
  const localBinary = path.join(process.cwd(), "node_modules", ".bin", binaryName);

  return { args, command: existsSync(localBinary) ? localBinary : rawCommand };
}

const resolved = resolveCommand(command);
const child = spawn(resolved.command, resolved.args, {
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
  shell: false,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
