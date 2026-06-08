# Kuato — point at your app, talk to Claude

Kuato is a small, terminal-native **visual-feedback tool** for building your own
React + Vite app together with [Claude Code](https://claude.com/claude-code).

You point at something in your running app and say what you want changed. Claude sees
exactly what you pointed at — the real source file and line, plus a screenshot — makes
the edit, and the page updates in front of you. It's a back-and-forth conversation with
a visual channel, not a task list.

---

## What it feels like

1. You have your app open in Chrome and Claude Code open in your terminal, side by side.
2. In the browser you flip on **Comment** mode and click the thing you mean — a button,
   a heading, a misworded sentence. A small **“?” marker** pins to it.
3. You tell Claude, in the terminal, what you want: *“make this the primary button,”*
   *“tighten this spacing,”* *“fix this typo.”*
4. Claude already knows **which** element you meant and **where it lives in the code**,
   reads it, takes a screenshot, and makes the change. Vite hot-reloads.
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

**You’ll need**
- [Node.js](https://nodejs.org) 18+
- [Claude Code](https://claude.com/claude-code)
- [agent-browser](https://github.com/vercel-labs/agent-browser) (see Credits) —
  `npm i -g agent-browser && agent-browser install`

**Install**
```bash
npm install
```

**Start a feedback session — the easy way**

In Claude Code, run:
```
/kuato
```
That starts the local daemon, starts the dev server, and opens your app in Chrome. Then
click **Comment**, click an element, and tell Claude what you want.

> First time: the `/kuato` command and the hooks are picked up when Claude Code starts,
> so if you don’t see `/kuato` yet, restart Claude Code once.

**Start it manually instead**
```bash
npm run dev      # the app at http://localhost:5173
npm run daemon   # the local feedback daemon (port 42100)
```

---

## How it works under the hood

Four small pieces, all in this repo:

- **The pointing overlay** (`src/overlay`) — the Comment toggle, hover highlight,
  click/text-select capture, the “?” marker, and the pin card. Injected into your page
  by the dev server.
- **The element→source bridge** (`src/bridge`) — turns a clicked element or a text
  selection into its real `file:line` + a CSS selector, using Vite’s built-in dev
  source data. (This is why it only works on *your own* dev server — that’s the
  intended scope.)
- **The daemon** (`src/daemon`) — a tiny local service that holds the one active pin and
  signals the overlay when Claude is done.
- **The seam** (`hooks/`) — two Claude Code hooks: one quietly attaches the pinned
  location to your next message; the other clears the “?” when Claude finishes.

When the daemon is running, feedback mode is **on**; when it isn’t, the hooks do nothing.
That’s what keeps Kuato cleanly separate from ordinary browser use — only `/kuato`
turns it on.

---

## Scripts

| Command | What it does |
|---|---|
| `/kuato` | Start a full feedback session (daemon + dev server + browser) |
| `npm run dev` | Run the app at http://localhost:5173 |
| `npm run daemon` | Run the local feedback daemon |
| `npm test` | Run the test suite |
| `npm run build` | Production build |

---

## Credits

The browser side rests on **[agent-browser](https://github.com/vercel-labs/agent-browser)
by [Vercel](https://vercel.com)** — a fast CLI that lets Claude drive and *see* a real
Chrome (snapshots, screenshots, stable element references) right from the terminal.
Kuato uses it as the shared browser surface so you and Claude are always looking at the
same thing. Thank you to the Vercel team for building it.

Built with [React](https://react.dev) + [Vite](https://vite.dev), and made to be used
with [Claude Code](https://claude.com/claude-code).

---

## Removing it

Everything Kuato adds — inside the project and the couple of things outside it — is
listed in [`docs/KUATO-FOOTPRINT.md`](docs/KUATO-FOOTPRINT.md), with exact removal steps.
