#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureHooksInstalled,
  removeHooks,
  hasKuatoHooks,
} from "./install/hooks.js";

// The `kuato` CLI — globally installed like the user's Frank tool (npm install -g, a
// symlink back to this repo). It runs in the CURRENT project's directory, so it knows
// which project you're in. It boots a project-agnostic daemon, wires the visual-feedback
// hooks into THIS project, and reports readiness. Opening the browser + injecting the
// overlay is left to the kuato skill (which owns agent-browser), keeping the CLI headless.

// Paths resolved from the install location (NOT the cwd), so hooks always point at the
// real installed scripts even when run from another project.
const __dirname = dirname(fileURLToPath(import.meta.url)); // <install>/dist
const INSTALL_ROOT = join(__dirname, "..");
const HOOKS_DIR = join(INSTALL_ROOT, "hooks");
const DAEMON_ENTRY = join(__dirname, "daemon", "main.js");
const OVERLAY_BUNDLE = join(__dirname, "overlay", "kuato-overlay.js");

const STATE_DIR = join(homedir(), ".kuato");
const PID_FILE = join(STATE_DIR, "daemon.pid");
const PORT = Number(process.env.VFT_DAEMON_PORT ?? 42100);
const BASE = `http://127.0.0.1:${PORT}`;

async function isDaemonUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/note`, {
      signal: AbortSignal.timeout(500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitUntilUp(timeoutMs = 4000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isDaemonUp()) return true;
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

function startDaemonDetached(): void {
  mkdirSync(STATE_DIR, { recursive: true });
  const child = spawn(process.execPath, [DAEMON_ENTRY], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, VFT_DAEMON_PORT: String(PORT) },
  });
  child.unref();
  if (child.pid) writeFileSync(PID_FILE, String(child.pid));
}

function stopDaemon(): void {
  if (!existsSync(PID_FILE)) return;
  const pid = Number(readFileSync(PID_FILE, "utf8").trim());
  if (pid) {
    try {
      process.kill(pid);
    } catch {
      /* already gone */
    }
  }
  rmSync(PID_FILE, { force: true });
}

async function cmdStart(url?: string): Promise<void> {
  const projectDir = process.cwd();

  if (await isDaemonUp()) {
    console.log(`✓ daemon already running on ${BASE}`);
  } else {
    startDaemonDetached();
    const up = await waitUntilUp();
    console.log(
      up
        ? `✓ daemon started on ${BASE}`
        : `! daemon did not come up on ${BASE} (check VFT_DAEMON_PORT)`
    );
  }

  ensureHooksInstalled(projectDir, HOOKS_DIR);
  console.log(`✓ hooks wired into ${join(projectDir, ".claude/settings.json")}`);

  const target = url ?? "http://localhost:5173";
  console.log("");
  console.log("Kuato is ready. Open your app and start the overlay:");
  console.log(`  • app URL: ${target}`);
  console.log(`  • overlay bundle: ${OVERLAY_BUNDLE}`);
  console.log(
    "In the browser: click Comment, then point at an element (or select text)."
  );
  console.log(
    "Then describe the change in the terminal — the pin rides along automatically."
  );
}

async function cmdStop(): Promise<void> {
  try {
    await fetch(`${BASE}/complete`, {
      method: "POST",
      signal: AbortSignal.timeout(500),
    });
  } catch {
    /* daemon may already be down */
  }
  stopDaemon();
  console.log("✓ daemon stopped (hooks stay installed; they no-op when it's down)");
}

async function cmdStatus(): Promise<void> {
  const up = await isDaemonUp();
  const wired = hasKuatoHooks(process.cwd());
  console.log(`daemon : ${up ? `up (${BASE})` : "down"}`);
  console.log(`hooks  : ${wired ? "wired in this project" : "not wired here"}`);
  console.log(`overlay: ${existsSync(OVERLAY_BUNDLE) ? OVERLAY_BUNDLE : "not built (run: npm run build)"}`);
}

async function cmdUninstall(): Promise<void> {
  removeHooks(process.cwd());
  stopDaemon();
  rmSync(STATE_DIR, { recursive: true, force: true });
  console.log("✓ removed Kuato hooks from this project and stopped the daemon");
}

function cmdOverlayPath(): void {
  // Print just the path so the skill can read + inject the bundle.
  console.log(OVERLAY_BUNDLE);
}

function usage(): void {
  console.log(`kuato — terminal-native visual feedback (any framework)

Usage:
  kuato start [url]   start daemon + wire hooks into this project
  kuato stop          stop the daemon
  kuato status        show daemon + hook + overlay state
  kuato uninstall     remove hooks from this project, stop daemon
  kuato overlay-path  print the overlay bundle path (for injection)`);
}

async function main(): Promise<void> {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case "start":
      await cmdStart(arg);
      break;
    case "stop":
      await cmdStop();
      break;
    case "status":
      await cmdStatus();
      break;
    case "uninstall":
      await cmdUninstall();
      break;
    case "overlay-path":
      cmdOverlayPath();
      break;
    case undefined:
    case "help":
    case "-h":
    case "--help":
      usage();
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      usage();
      process.exitCode = 1;
  }
}

main();
