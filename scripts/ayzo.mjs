#!/usr/bin/env node
/**
 * One command to set AYZO up and one to run it.
 *
 *   node scripts/ayzo.mjs setup    create the Python environment, install everything, build the dashboard
 *   node scripts/ayzo.mjs start    run the API (8000) and the dashboard (3000)
 *
 * (`pnpm setup:ayzo` and `pnpm start` call these.)
 *
 * The dashboard runs from a production build, which needs about a tenth of
 * the memory of the development server.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = join(root, "apps", "api");
const web = join(root, "apps", "web");
const windows = process.platform === "win32";
const venvPython = join(api, ".venv", windows ? "Scripts" : "bin", windows ? "python.exe" : "python");

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: windows });
  if (result.status !== 0) {
    console.error(`\nThat step failed (${command}). Fix the error above and run the command again.`);
    process.exit(result.status ?? 1);
  }
}

function hasUv() {
  return spawnSync("uv", ["--version"], { stdio: "ignore", shell: windows }).status === 0;
}

function setup() {
  if (hasUv()) {
    // Reproducible: install the exact pinned set from uv.lock (what CI uses).
    run("uv", ["sync", "--locked", "--extra", "dev"], api);
  } else {
    // No uv: fall back to pip. Versions resolve from pyproject floors, not the lock.
    if (!existsSync(venvPython)) run(windows ? "python" : "python3", ["-m", "venv", ".venv"], api);
    run(venvPython, ["-m", "pip", "install", "-q", "-e", ".[dev]"], api);
  }
  if (!existsSync(join(api, ".env"))) {
    run(venvPython, ["-c", "import shutil; shutil.copy('.env.example', '.env')"], api);
  }
  run("pnpm", ["install"], root);
  run("pnpm", ["install"], web);
  run("npx", ["next", "build"], web);
  console.log("\nAYZO is set up. Start it with:  pnpm start");
}

function start() {
  if (!existsSync(venvPython) || !existsSync(join(web, ".next", "BUILD_ID"))) {
    console.error("AYZO is not set up yet. Run:  pnpm setup:ayzo");
    process.exit(1);
  }
  const children = [
    spawn(venvPython, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], { cwd: api, stdio: "inherit" }),
    spawn("npx", ["next", "start", "--port", "3000"], { cwd: web, stdio: "inherit", shell: windows }),
  ];
  console.log("\nAYZO is starting. Dashboard: http://localhost:3000   (Ctrl+C stops both)\n");
  const stop = () => children.forEach((child) => child.kill());
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  // If either one stops, stop the other: half of AYZO is no use.
  children.forEach((child) => child.on("exit", (code) => { stop(); process.exit(code ?? 0); }));
}

const command = process.argv[2];
if (command === "setup") setup();
else if (command === "start") start();
else {
  console.log("Usage: node scripts/ayzo.mjs setup | start");
  process.exit(1);
}
