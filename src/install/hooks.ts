import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

// Wire Kuato's two Claude Code hooks into a project's .claude/settings.json:
//   UserPromptSubmit → send-note.mjs   (inject the buffered pin as context)
//   Stop             → signal-done.mjs (tell the daemon Claude finished → clears "?")
//
// The CLI calls this for the CURRENT working directory, so `kuato` knows which project
// you're in. It is idempotent and never clobbers the user's other hooks. Kuato's own
// entries are identified by the hook SCRIPT NAME (not the full path), so a moved or
// relinked install is still recognised and cleanly removed.

const SCRIPTS = {
  UserPromptSubmit: "send-note.mjs",
  Stop: "signal-done.mjs",
} as const;

const STATUS = {
  UserPromptSubmit: "Attaching visual-feedback note",
  Stop: "Clearing visual-feedback marker",
} as const;

type HookEvent = keyof typeof SCRIPTS;
const EVENTS = Object.keys(SCRIPTS) as HookEvent[];

const KUATO_SCRIPTS = Object.values(SCRIPTS);

function settingsFile(projectDir: string): string {
  return join(projectDir, ".claude", "settings.json");
}

function loadSettings(projectDir: string): any {
  const file = settingsFile(projectDir);
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(projectDir: string, settings: any): void {
  const file = settingsFile(projectDir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
}

// Is this hook group one of Kuato's? Match by script basename so it holds across installs.
function isKuatoGroup(group: any): boolean {
  const hooks = group?.hooks;
  if (!Array.isArray(hooks)) return false;
  return hooks.some(
    (h: any) =>
      typeof h?.command === "string" &&
      KUATO_SCRIPTS.some((s) => h.command.includes(s))
  );
}

export function ensureHooksInstalled(projectDir: string, hooksDir: string): void {
  const settings = loadSettings(projectDir);
  settings.hooks ??= {};

  for (const event of EVENTS) {
    const command = `node ${join(hooksDir, SCRIPTS[event])}`;
    const existing: any[] = Array.isArray(settings.hooks[event])
      ? settings.hooks[event]
      : [];
    // Drop any prior Kuato group (idempotent / re-point), keep everything else.
    const others = existing.filter((g) => !isKuatoGroup(g));
    others.push({
      hooks: [
        {
          type: "command",
          command,
          timeout: 5,
          statusMessage: STATUS[event],
        },
      ],
    });
    settings.hooks[event] = others;
  }

  saveSettings(projectDir, settings);
}

export function removeHooks(projectDir: string): void {
  const file = settingsFile(projectDir);
  if (!existsSync(file)) return;
  const settings = loadSettings(projectDir);
  if (!settings.hooks) return;

  for (const event of EVENTS) {
    const groups = settings.hooks[event];
    if (!Array.isArray(groups)) continue;
    const kept = groups.filter((g: any) => !isKuatoGroup(g));
    if (kept.length) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }

  saveSettings(projectDir, settings);
}

export function hasKuatoHooks(projectDir: string): boolean {
  const settings = loadSettings(projectDir);
  const hooks = settings.hooks;
  if (!hooks) return false;
  return EVENTS.some(
    (event) =>
      Array.isArray(hooks[event]) && hooks[event].some(isKuatoGroup)
  );
}
