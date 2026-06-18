import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..");
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "3200";
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "5174";
const e2eDbPath =
  process.env.WBD_E2E_DB_PATH ?? path.join(repoRoot, "db", "e2e");

fs.mkdirSync(e2eDbPath, { recursive: true });

const children = new Set<ChildProcess>();

function spawnService(
  name: string,
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
) {
  const env = {
    ...process.env,
    ...options.env,
  };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;

  const child = spawn(command, args, {
    cwd: options.cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.add(child);

  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`[${name}] ${data.toString()}`);
  });

  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[${name}] ${data.toString()}`);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      return;
    }

    console.error(
      `[${name}] exited with ${signal ? `signal ${signal}` : `code ${code}`}`,
    );
    shutdown(code ?? 1);
  });

  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    child.kill();
  }

  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Starting API on http://127.0.0.1:${apiPort}`);
console.log(`Starting web on http://127.0.0.1:${webPort}`);
console.log(`Using E2E DB path: ${e2eDbPath}`);

spawnService("api", "bun", ["run", "src/start.ts"], {
  cwd: path.join(repoRoot, "apps", "api"),
  env: {
    PORT: apiPort,
    WBD_DB_PATH: e2eDbPath,
    WBD_CF_CAPTCHA_ENABLED: "false",
    WBD_BACKUP_S3_ENABLED: "false",
  },
});

spawnService(
  "web",
  "bun",
  ["run", "vite", "--host", "127.0.0.1", "--port", webPort, "--strictPort"],
  {
    cwd: path.join(repoRoot, "apps", "web"),
    env: {
      VITE_API_PORT: apiPort,
    },
  },
);
