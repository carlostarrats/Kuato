# Kuato — Footprint & Removal Guide

Everything Claude created for the Visual Feedback Tool, and exactly how to remove
each piece. Split into **inside the project** (gone if you delete the project folder)
and **outside the project** (lives elsewhere on your machine — must be removed by hand).

> TL;DR — to remove *everything*: delete the project folder
> `/Users/carlostarrats/Documents/Projects/Kuato`, then do the two **outside-the-project**
> cleanups in section B.

---

## A. Inside the project folder (`/Users/carlostarrats/Documents/Projects/Kuato`)

Deleting the project folder removes all of this at once. To remove individual parts
while keeping the project:

| Artifact | Path | What it is | Remove by |
|---|---|---|---|
| App source | `src/` | The whole tool: `bridge/` (element→source), `overlay/` (pointing overlay + daemon client), `daemon/` (note daemon + HTTP server), `note.ts`, `App.tsx`, `main.tsx` | delete `src/` |
| Hook scripts | `hooks/send-note.mjs`, `hooks/signal-done.mjs` | The two Claude Code hooks (each has a `KUATO VISUAL-FEEDBACK TOOL` banner at the top) | delete `hooks/` |
| Hook wiring | `.claude/settings.json` | Registers the two hooks (`UserPromptSubmit` → send, `Stop` → signal). **Cannot hold a comment** — Claude Code rejects unknown keys — which is why it's documented here. Currently contains ONLY Kuato hooks. | delete the file, or remove the `UserPromptSubmit` + `Stop` blocks whose commands point at `/Kuato/hooks/` |
| Start command | `.claude/commands/kuato.md` | The `/kuato` slash command that boots a feedback session (daemon + dev server + browser) | delete the file |
| Build/test config | `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | Standard React+Vite scaffolding for this app | delete with the project |
| Dependencies | `node_modules/`, `package-lock.json` | Installed npm packages | `rm -rf node_modules package-lock.json` |
| Specs/docs | `docs/` | The original spec + milestone loop files + this footprint | delete `docs/` |

**Find the hook wiring anytime:**
```bash
grep -rl "Kuato/hooks" /Users/carlostarrats/Documents/Projects/Kuato/.claude
```

---

## B. Outside the project folder (must remove by hand)

These live in your home directory and will survive deleting the project folder.

### 1. Claude's memory about this project
- **Path:** `~/.claude/projects/-Users-carlostarrats-Documents-Projects-Kuato/memory/`
- **What:** notes Claude wrote so future sessions remember Kuato + that agent-browser
  is installed (`agent-browser-installed.md`, `kuato-visual-feedback-tool.md`, `MEMORY.md`).
- **Remove:**
  ```bash
  rm -rf ~/.claude/projects/-Users-carlostarrats-Documents-Projects-Kuato/memory
  ```

### 2. agent-browser's downloaded Chrome  *(shared — usually keep)*
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
