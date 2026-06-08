# Kuato — point at your app, talk to Claude

Kuato is a small, terminal-native **visual-feedback tool** for building your own web app
— **any framework** (React, Vue, Svelte, Next, or plain HTML) — together with
[Claude Code](https://claude.com/claude-code).

You point at something in your running app and say what you want changed. Claude sees
exactly what you pointed at — its text, attributes, a selector, and a screenshot — finds
where it lives in your code by **searching the repo**, makes the edit, and the page
updates in front of you. It's a back-and-forth conversation with a visual channel, not a
task list.

**The code doesn't matter.** Kuato captures what's *rendered in the browser*, not any
framework-specific dev breadcrumb, so it works the same whether your app is React, Vue,
Svelte, Next, or a static HTML file.

Kuato is **free and open source** under the [MIT License](LICENSE) — use it, fork it,
build on it.

---

## What it feels like

1. You have your app open in Chrome and Claude Code open in your terminal, side by side.
2. In the browser you flip on **Comment** mode and click the thing you mean — a button,
   a heading, a misworded sentence. A small **“?” marker** pins to it.
3. You tell Claude, in the terminal, what you want: *“make this the primary button,”*
   *“tighten this spacing,”* *“fix this typo.”*
4. Claude knows **which** element you meant, finds **where it lives in the code** by
   searching for it, takes a screenshot, and makes the change. Your dev server hot-reloads.
5. The “?” disappears the moment the change is visible — your turn again.

One thing in the air at a time. The marker *is* the turn indicator: present means it’s
Claude’s turn, gone means it’s yours.

---

## Why it's split this way

There’s no app to live inside. You keep your **normal terminal** (Claude never leaves
Claude Code) and your **normal dev browser** (pointed at localhost). The only new thing
on the page is a lightweight overlay: the **Comment** toggle, the hover highlight, and
the “?” marker.

The key idea: **you only ever type in one place — the terminal.** The browser answers
*“which thing?”* (you click to pin it), and the terminal answers *“what about it?”*
(you describe the change). There’s deliberately **no comment box in the browser** — your
message to Claude *is* the comment, and the pin silently rides along with it.

---

## Getting started

### 1. Install the prerequisites
- [Node.js](https://nodejs.org) 18+
- [Claude Code](https://claude.com/claude-code)
- [agent-browser](https://github.com/vercel-labs/agent-browser) (see Credits):
  ```bash
  npm i -g agent-browser && agent-browser install
  ```

### 2. Install Kuato globally (one-time)

From this repo:
```bash
npm install
npm run build
npm install -g .
kuato install      # install the Claude Code skill (one-time)
```
The first three lines build the tool and symlink a global **`kuato`** command (just like a
regular CLI), so it works from **any project**. `kuato install` then copies the bundled
Claude Code skill to `~/.claude/skills/kuato/`, which teaches Claude Code how to drive it —
no per-project hook editing, no absolute paths to paste. (`kuato install` only ever writes
to `~/.claude/skills/kuato/`; it never touches your other skills.) Restart Claude Code (or
open `/skills`) once so it picks up the new skill, then confirm:
```bash
kuato status       # shows daemon, hooks, overlay, and skill state
```

### 3. Start a feedback session — in any project

Open your app's dev server (whatever framework, whatever port), then in Claude Code say:
```
kuato            # or: kuato http://localhost:3000
```
Claude runs `kuato start`, which boots the local daemon and wires the two feedback hooks
into **the project you're in**. Then Claude opens your app in Chrome and injects the
overlay. Flip on **Comment**, click an element (or select text), and tell Claude what you
want — the pin rides along with your message automatically.

Under the hood `kuato start` does two things:
- starts the **daemon** (port 42100) — a tiny local relay, framework-agnostic;
- wires `send-note.mjs` (UserPromptSubmit) + `signal-done.mjs` (Stop) into this project's
  `.claude/settings.json`, pointing at the installed scripts. They no-op when the daemon
  is down, so they're safe to leave.

> **Reload note.** Claude Code reads hooks at startup. The first time `kuato start` wires
> hooks into a project, restart Claude Code (or open `/hooks`) so they take effect.

Stop anytime with `kuato stop`; remove a project's hooks entirely with `kuato uninstall`.

---

## How it works under the hood

Five small pieces, all in this repo:

- **The standalone overlay** (`src/overlay`) — the Comment toggle, hover highlight,
  click/text-select capture, the “?” marker, and the pin card. A self-contained vanilla-JS
  bundle (`dist/overlay/kuato-overlay.js`) injected into **whatever page is in the
  browser** — no React or framework needed on the host page.
- **The capture bridge** (`src/bridge/captureContext.ts`) — turns a clicked element or a
  text selection into its framework-agnostic **identity**: visible text, a CSS selector,
  curated attributes (`data-*`, `aria-label`, …), and surrounding context. Claude — already
  in your repo — finds the source by **searching** for that identity. (A React+Vite dev
  breadcrumb, if present, rides along as an optional hint; it's never required.)
- **The daemon** (`src/daemon`) — a tiny local service that holds the one active pin and
  signals the overlay when Claude is done.
- **The seam** (`hooks/`) — two Claude Code hooks: one quietly attaches the pinned
  element to your next message; the other clears the “?” when Claude finishes.
- **The CLI** (`src/cli.ts`) — the global `kuato` command (`start`/`stop`/`status`/
  `uninstall`) that boots the daemon and wires the hooks into the current project.

When the daemon is running, feedback mode is **on**; when it isn’t, the hooks do nothing.
That’s what keeps Kuato cleanly separate from ordinary browser use — only `kuato` turns
it on.

---

## Scripts

| Command | What it does |
|---|---|
| `kuato start [url]` | Start the daemon + wire feedback hooks into the current project |
| `kuato stop` | Stop the daemon |
| `kuato status` | Show daemon + hook + overlay state |
| `kuato uninstall` | Remove this project's hooks and stop the daemon |
| `npm run build` | Compile the CLI/daemon + bundle the overlay to `dist/` |
| `npm test` | Run the test suite |

---

## Good to know

- **One pin at a time.** While a “?” is pending, the page is intentionally click-inert so
  you can’t start a second pin. Press **Cancel** on the pin card, or toggle **Comment**
  off, to get the page back.
- **Reloads.** The overlay lives on `document.body`, so it survives Vite-style **HMR**.
  A **full page reload** (a hard refresh, or frameworks that full-reload instead of
  hot-swapping) wipes it — Claude re-injects it automatically on the next turn when it
  notices the Comment button is gone.
- **Hooks are safe to leave.** `send-note.mjs` / `signal-done.mjs` do nothing unless the
  daemon is running, so a project that’s been `kuato start`-ed once is harmless when the
  daemon is off. Run `kuato uninstall` to remove them entirely.
- **Any framework, your own dev server.** Kuato overlays onto the app *you* are running
  (any port, any stack). It captures what’s rendered; Claude finds the source by search.

---

## Credits

The browser side rests on **[agent-browser](https://github.com/vercel-labs/agent-browser)
by [Vercel](https://vercel.com)** — a fast CLI that lets Claude drive and *see* a real
Chrome (snapshots, screenshots, stable element references) right from the terminal.
Kuato uses it as the shared browser surface so you and Claude are always looking at the
same thing. Thank you to the Vercel team for building it.

Built as a small, dependency-light TypeScript CLI (compiled with `tsc`, overlay bundled
with [esbuild](https://esbuild.github.io)), and made to be used with
[Claude Code](https://claude.com/claude-code).

---

## Removing it

Everything Kuato adds — inside the project and the couple of things outside it — is
listed in [`docs/KUATO-FOOTPRINT.md`](docs/KUATO-FOOTPRINT.md), with exact removal steps.

---

## License

[MIT](LICENSE) © Carlos Tarrats. Open source — contributions and forks welcome.

Note: this license covers Kuato’s own code. [agent-browser](https://github.com/vercel-labs/agent-browser)
is a separate project by Vercel with its own license.
