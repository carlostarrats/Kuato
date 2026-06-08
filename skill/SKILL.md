---
name: kuato
description: Kuato is the user's own terminal-native visual-feedback tool. Use when the user says "kuato", "start kuato", "open kuato", or asks to point at something in the browser and have the change applied. Works on ANY framework (React, Vue, Svelte, Next, plain HTML) — the user clicks an element in the browser, you make the code change. Runs locally; daemon on port 42100. The user triggers it ("kuato") and you run the CLI.
allowed-tools: Bash(kuato:*), Bash(agent-browser:*), Bash(osascript:*), Bash(npm install -g *), Bash(npm run build), Bash(rg:*)
---

# Kuato

Kuato is **the user's own tool** — a terminal-native visual-feedback loop. The user points at an element in the running app (clicks it, or selects text), then describes the change in the terminal; the pin rides along with their message and you apply it. It works on **whatever is in the browser, any framework**, because it captures the element's *identity* (text, attributes, selector, surrounding context) and you locate the source by **searching the repo** — not by any framework-specific breadcrumb.

The global `kuato` command is installed like any CLI (`npm install -g .` from the repo). Daemon runs at **http://127.0.0.1:42100**.

This is a deliberate, separate mode from normal browser use — the daemon is the on-switch that makes the visual-feedback hooks live.

## When the user says "kuato" (optionally with their app URL)

1. **Start it** (runs in the user's current project, wiring the hooks into *that* project):
   ```bash
   kuato start [url]     # starts the daemon + wires this project's hooks
   ```
   Default URL is http://localhost:5173 — pass the real one if the user's dev server is elsewhere (`kuato start http://localhost:3000`). The user starts their OWN dev server; Kuato just overlays onto it.

2. **Open the app and inject the overlay** via the `agent-browser` skill:
   - **Open the app URL in a VISIBLE window. `agent-browser` defaults to HEADLESS, so you MUST pass `--headed`:**
     ```bash
     agent-browser --headed open <url>
     agent-browser wait --load networkidle
     ```
     Without `--headed` the page loads in an invisible browser: the user sees nothing and cannot click **Comment**. This is not optional — the entire tool is point-and-click, so a window the user can actually see and interact with is mandatory. Never open the page headless and then wonder why the user reports "I don't see anything."
   - **The window is "Google Chrome for Testing"** — `agent-browser` drives its own bundled Chrome, which is a *separate app* from the user's everyday Chrome and is labeled accordingly. This is expected. Tell the user to look for **Chrome for Testing** (⌘-Tab / dock), not their normal browser. If the user instead wants the overlay in their *own* running browser, connect to it with `agent-browser --auto-connect open <url>` (requires their Chrome to have been launched with `--remote-debugging-port`).
   - **On macOS, bring the window to the front** so it doesn't open behind other windows:
     ```bash
     osascript -e 'tell application "Google Chrome for Testing" to activate'
     ```
   - **Inject the overlay bundle** into the active tab — its path is `kuato overlay-path` (a self-contained IIFE; evaluate its contents as JavaScript in the page). It mounts a **Comment** button and guards against double-injection:
     ```bash
     agent-browser eval "$(cat "$(kuato overlay-path)")"
     ```
   - **Confirm it loaded** before telling the user it's ready:
     ```bash
     agent-browser eval "!!document.querySelector('[data-vft-toggle]')"   # must print: true
     ```
     Then take a screenshot to visually confirm the **Comment** button is present.

3. **Tell the user it's ready**, roughly:
   > Comment mode is ready in the **Chrome for Testing** window. Click **Comment**, then click an
   > element (or select text) to pin it. Then just tell me here what you want changed — the
   > pinned element's identity and a screenshot come to me automatically. The "?" marker
   > clears when the change is live. One pin at a time.

## The feedback loop (one pin, one change)

When a pin's context arrives alongside the user's message, act on THAT element:
- **Locate the source by searching** — ripgrep the repo for the captured visible text / `data-*` / `aria-label` / id, then narrow and confirm the match renders this element. Do NOT expect a `file:line` to be handed to you; the optional `source hint` (only present on React+Vite dev) is a convenience to *verify*, never to trust blindly.
- **See it** — screenshot the element via `agent-browser` using the pin's selector.
- **Make the change** and let the user's dev server hot-reload. The "?" marker clears on RESULT (the Stop hook), not at edit start.
- **Re-inject if the page fully reloaded.** The overlay survives Vite-style HMR (it lives on `document.body`), but a **full page reload** (some frameworks, a hard refresh, or a static page with no HMR) wipes it. After a change, if the **Comment** button is gone (`agent-browser eval "!document.querySelector('[data-vft-toggle]')"` prints `true`), re-inject the overlay bundle so the next pin still works. Cheap to check each turn.
- **Don't queue or batch** — one pin, one change, then the marker clears and it's their turn.

To end the session: `kuato stop` (stops the daemon; hooks stay installed and harmlessly no-op when the daemon is down). `kuato uninstall` removes the hooks from the current project entirely.

## Self-heal: if `kuato` is missing or broken

If `command -v kuato` fails, or it errors with "command not found", or `kuato status` shows the overlay "not built":

1. Find the source: `find ~/Documents/Projects -maxdepth 3 -type d -iname kuato 2>/dev/null` (look for one with a `src/cli.ts` and a `hooks/` dir).
2. Rebuild + relink: in that directory run `npm install && npm run build && npm install -g .`
3. Re-install this skill so it matches the build: `kuato install`
4. Verify: `kuato status`
