import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureHooksInstalled, removeHooks, hasKuatoHooks } from "./hooks";

// The CLI wires Kuato's two Claude Code hooks into the CURRENT project's
// .claude/settings.json, pointing at absolute paths in the Kuato install. It must be
// idempotent and must never clobber the user's other hooks.

let projectDir: string;
const HOOKS_DIR = "/opt/kuato/hooks";

function settingsPath(): string {
  return join(projectDir, ".claude", "settings.json");
}
function readSettings(): any {
  return JSON.parse(readFileSync(settingsPath(), "utf8"));
}

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "kuato-proj-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

describe("hook installer", () => {
  it("creates .claude/settings.json with both hooks pointing at the install", () => {
    ensureHooksInstalled(projectDir, HOOKS_DIR);

    const s = readSettings();
    const submit = JSON.stringify(s.hooks.UserPromptSubmit);
    const stop = JSON.stringify(s.hooks.Stop);
    expect(submit).toContain(join(HOOKS_DIR, "send-note.mjs"));
    expect(stop).toContain(join(HOOKS_DIR, "signal-done.mjs"));
    expect(hasKuatoHooks(projectDir)).toBe(true);
  });

  it("is idempotent — running twice does not duplicate the hooks", () => {
    ensureHooksInstalled(projectDir, HOOKS_DIR);
    ensureHooksInstalled(projectDir, HOOKS_DIR);

    const s = readSettings();
    expect(s.hooks.UserPromptSubmit).toHaveLength(1);
    expect(s.hooks.Stop).toHaveLength(1);
  });

  it("preserves the user's unrelated hooks and settings", () => {
    mkdirSync(join(projectDir, ".claude"), { recursive: true });
    writeFileSync(
      settingsPath(),
      JSON.stringify({
        model: "opus",
        hooks: {
          UserPromptSubmit: [
            { hooks: [{ type: "command", command: "node /my/other-hook.mjs" }] },
          ],
        },
      })
    );

    ensureHooksInstalled(projectDir, HOOKS_DIR);

    const s = readSettings();
    expect(s.model).toBe("opus"); // untouched
    const cmds = JSON.stringify(s.hooks.UserPromptSubmit);
    expect(cmds).toContain("/my/other-hook.mjs"); // kept
    expect(cmds).toContain(join(HOOKS_DIR, "send-note.mjs")); // added
    expect(s.hooks.UserPromptSubmit).toHaveLength(2);
  });

  it("removeHooks strips only Kuato's hooks, leaving others intact", () => {
    mkdirSync(join(projectDir, ".claude"), { recursive: true });
    writeFileSync(
      settingsPath(),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [
            { hooks: [{ type: "command", command: "node /my/other-hook.mjs" }] },
          ],
        },
      })
    );
    ensureHooksInstalled(projectDir, HOOKS_DIR);

    removeHooks(projectDir);

    const s = readSettings();
    expect(hasKuatoHooks(projectDir)).toBe(false);
    const cmds = JSON.stringify(s.hooks.UserPromptSubmit);
    expect(cmds).toContain("/my/other-hook.mjs"); // user's hook survives
    expect(cmds).not.toContain("send-note.mjs"); // kuato gone
  });

  it("hasKuatoHooks is false when nothing is installed", () => {
    expect(hasKuatoHooks(projectDir)).toBe(false);
  });

  it("matches Kuato hooks by script name, so a moved/relinked install still removes", () => {
    ensureHooksInstalled(projectDir, "/old/path/hooks");
    // simulate the install having moved — remove still finds them by script name
    removeHooks(projectDir);
    expect(hasKuatoHooks(projectDir)).toBe(false);
  });
});
