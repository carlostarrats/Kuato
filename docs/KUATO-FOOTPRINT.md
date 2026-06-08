# Kuato — Footprint & Removal Guide

Everything Claude created for the Visual Feedback Tool, and exactly how to remove
each piece. Split into **inside the project** (gone if you delete the project folder)
and **outside the project** (lives elsewhere on your machine — must be removed by hand).

> TL;DR — Kuato is now a **global** tool, so deleting the project folder isn't enough.
> To remove *everything*:
> ```bash
> npm uninstall -g kuato                 # the global `kuato` command
> rm -rf ~/.claude/skills/kuato ~/.kuato # the global skill + daemon state
> # then, in any project you ran it in:  kuato uninstall  (before removing the global)
> rm -rf /Users/carlostarrats/Documents/Projects/Kuato   # the source repo
> ```
> Plus the optional **outside-the-project** cleanups in section B (memory; agent-browser
> is shared — usually keep). Tip: run any per-project `kuato uninstall` *before*
> `npm uninstall -g kuato`, since uninstalling the global removes the `kuato` command.

---

## A. Inside the project folder (`/Users/carlostarrats/Documents/Projects/Kuato`)

Deleting the project folder removes all of this at once. To remove individual parts
while keeping the project:

| Artifact | Path | What it is | Remove by |
|---|---|---|---|
| Source | `src/` | The whole tool: `bridge/captureContext.ts` (framework-agnostic element capture), `overlay/` (standalone vanilla overlay + inject entry + daemon client), `daemon/` (note daemon + HTTP server), `install/hooks.ts` (per-project hook wiring), `cli.ts`, `note.ts` | delete `src/` |
| Build output | `dist/`, `scripts/build-overlay.mjs` | Compiled daemon/CLI + the bundled overlay IIFE (`dist/overlay/kuato-overlay.js`) | `rm -rf dist` |
| Hook scripts | `hooks/send-note.mjs`, `hooks/signal-done.mjs` | The two Claude Code hooks (each has a `KUATO VISUAL-FEEDBACK TOOL` banner at the top) | delete `hooks/` |
| Build/test config | `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` | CLI package config (no React/Vite anymore — `bin: kuato`) | delete with the project |
| Examples | `examples/` | Plain-HTML / Vue / Svelte fixtures proving framework-independence | delete `examples/` |
| Dependencies | `node_modules/`, `package-lock.json` | Installed npm packages (dev-only: tsc, esbuild, vitest) | `rm -rf node_modules package-lock.json` |
| Specs/docs | `docs/` | The original spec + milestone loop files + this footprint | delete `docs/` |

> Note: `kuato` is now a **global CLI + skill**, not a project `/kuato` command. The
> `.claude/settings.json` *inside this repo* only exists because the repo dogfoods itself;
> `kuato start` writes the same hooks into **whatever project you run it in** (see B.3).

**Find Kuato hook wiring in any project anytime:**
```bash
grep -rl "send-note.mjs\|signal-done.mjs" <project>/.claude
# or, from inside a project:  kuato status
```

---

## B. Outside the project folder (must remove by hand)

These live in your home directory and will survive deleting the project folder.

### 1. Global `kuato` command (symlink) + global skill
- **What:** `npm install -g .` symlinked a global `kuato` (e.g. `/opt/homebrew/bin/kuato`)
  back to this repo's `dist/cli.js`; `~/.claude/skills/kuato/SKILL.md` is the global skill
  that loads in every project.
- **Remove:**
  ```bash
  npm uninstall -g kuato
  rm -rf ~/.claude/skills/kuato
  ```

### 2. Per-project hooks + daemon state
- **What:** `kuato start` writes the two hooks into **each project's** `.claude/settings.json`
  (pointing at this repo's `hooks/*.mjs`), and the daemon keeps a pidfile at `~/.kuato/`.
- **Remove:** from inside a project run `kuato uninstall` (strips that project's hooks +
  stops the daemon). To wipe daemon state: `rm -rf ~/.kuato`. The hooks no-op when the
  daemon is down, so leftover wiring is harmless.

### 3. Claude's memory about this project
- **Path:** `~/.claude/projects/-Users-carlostarrats-Documents-Projects-Kuato/memory/`
- **What:** notes Claude wrote so future sessions remember Kuato + that agent-browser
  is installed (`agent-browser-installed.md`, `kuato-visual-feedback-tool.md`, `MEMORY.md`).
- **Remove:**
  ```bash
  rm -rf ~/.claude/projects/-Users-carlostarrats-Documents-Projects-Kuato/memory
  ```

### 4. agent-browser's downloaded Chrome  *(shared — usually keep)*
- **Path:** `~/.agent-browser/browsers/`
- **What:** Chrome-for-Testing downloaded by `agent-browser install`. This belongs to
  the **agent-browser** CLI (which was already installed before Kuato), not to Kuato.
  Other projects use it too.
- **Recommendation:** leave it. Only remove if you're also uninstalling agent-browser:
  ```bash
  npm uninstall -g agent-browser && rm -rf ~/.agent-browser
  ```

---

## Not added by Kuato (do not attribute to it)
- `agent-browser` the CLI — was already installed (Homebrew) before this work.
- Your global `~/.claude/CLAUDE.md` (the "Frank" section) — pre-existing, untouched.
