# Visual Feedback Tool — Spec

> ⚠️ **Historical / superseded.** This spec (and the `loop-task-milestone-*.md` and
> `coverage-map.md` files) describe the original **React + Vite** design, where a clicked
> element was resolved to `file:line` via React fiber `_debugSource` breadcrumbs. Kuato was
> since reworked to be **framework-agnostic**: the overlay captures the element's identity
> (text, attributes, selector, context) and Claude finds the source by **searching the
> repo** — so it works on React, Vue, Svelte, Next, or plain HTML. It's also now a global
> `kuato` CLI + skill, not a project `/kuato` command. For the current design and usage,
> see [`../README.md`](../README.md) and [`KUATO-FOOTPRINT.md`](KUATO-FOOTPRINT.md). This
> file is kept only as a record of the original intent.

A terminal-native, conversational visual-feedback tool for developing your own web app
together with Claude Code. You point at things in your running app and leave comments;
Claude sees what you pointed at (with the real source location), changes the code, and the
page updates in front of both of you. Claude can also drive the browser itself so you're
always looking at the same thing in the same window.

---

## Core philosophy

This is a **back-and-forth conversation**, not a task queue. One thing in the air at a time.
You raise a point, Claude addresses it, the page updates, your turn again. Every UI decision
follows from this — no numbered lists, no batches, no persistent worklist.

---

## Form factor

- **Spatial layout, two windows.** Terminal (Claude Code) and Chrome side by side. Arrange
  them however you like. No combined app shell — the terminal stays the real terminal so
  Claude never leaves Claude Code. (This is the deliberate difference from the Codex-app shape.)
- **The browser is a shared surface, not a destination.** It's your normal dev browser pointed
  at localhost. Claude reaches out to it; you annotate on it. Neither of you "goes into" an app.
- **Polish lives in the page overlay** — the toggle, dialog, and marker that live _on the page_.
  Not in a docked panel and not in wrapping the terminal (both considered and rejected). Pure
  spatial layout: two independent windows.

---

## Stack

- **React + Vite.** Best click-to-source story (source location data is built in), lightweight,
  dependable. This is the load-bearing choice: the whole tool rests on resolving a clicked
  element back to its source file and line.

---

## The two roles

**You** — point and comment. Toggle annotate mode, click an element or select text, leave a
comment. That's it.

**Claude** — drives the browser and edits code. Opens files, clicks, navigates so you both see
the same state with no assumptions, then makes the change you asked for.

---

## The annotation interaction

1. **Connect / annotate toggle.** A button on the page. Off by default — page behaves normally.
   On → the page enters annotate mode; clicks become note targets instead of normal actions.
2. **Hover highlights** the element you're about to grab, so you know what you're pinning.
3. **Click an element _or_ select text.** Two note types:
   - element note (click)
   - text-selection note (highlight text — for typos, copy changes, pointing at specific words)
4. **A small dialog appears** at that spot: a comment field + **Cancel** and **Comment (Connect)**.
   - Cancel → backs out, no trace.
   - Comment → drops the marker and **sends automatically**. The intent is to minimize friction
     so it feels like conversation, not dispatch. In practice you're usually talking to Claude
     anyway, so the note rides along with what you say — its job is to silently attach the _where_
     and the _code_ to your words. (Making the note fire with zero terminal input at all is the
     harder edge — see Open build risks.)
5. **What the note carries (silently):** your comment **+** the element's resolved source
   location **+** selector/text. You type only the comment; the overlay attaches the rest. This
   pairing (comment + code location) is the entire value.

---

## The marker ("?")

- A small **"?" in a circle**, pinned to the element you commented on.
- It's a **receipt + pending-state**: "your comment landed here" AND "this hasn't been updated yet."
  It answers the two anxieties — _did it send?_ (yes, there's the mark) and _has Claude dealt with
  it?_ (not while it's there).
- It also acts as the **turn indicator**: present = Claude's turn; gone = your turn again.
- **One at a time.** Not numbered. Transient, singular — a live question, not a record.
- **Subtle throb.** A slow, faint pulse behind the "?" so it reads as _alive and waiting_, not
  abandoned — and NOT as "working" (the marker doesn't actually know Claude is mid-edit). Keep it
  slow/low-opacity; calm, not urgent. Bonus: a gently breathing marker going still + vanishing makes
  the resolution land cleanly.

---

## Resolution (when the "?" clears)

The marker clears when the change becomes **visible** — synced to the result, honest.

> **Note on timing:** you first described the "?" going away "when edits are made visually" / as
> Claude _starts_ editing. The mechanics push this to clear-on-_result_ instead: Claude doesn't
> type into the live page — it edits code, saves, and Vite hot-reloads, so the change appears in
> discrete pops, not keystroke-by-keystroke. Clearing on the visible result (rather than at edit
> start) keeps the marker honest — it's gone precisely because you can now _see_ the thing changed.
> This is a small, deliberate shift from the original "starts editing" wording.

- **Single edit:** Claude edits → saves → Vite hot-reloads → the "?" clears on that reload.
  Stays snappy; no overlay.
- **Multi-edit (more than one reload):** the page drops into an **"updating" overlay**
  (dimmed/blurred "Claude's working…" state) after the second reload. The messy intermediate
  reflows happen _behind the curtain_ so you never watch the "?" jump around on shifting layout.
  The overlay **lifts on Claude's completion signal**, revealing the finished page with the
  marker gone.

**Why a completion signal is still needed:** the page can't tell "still going" from "done" by
watching reloads alone. The reload makes the change _visible_; Claude's done-signal tells the
page _that was the last one_ (single edit) / _lift the curtain_ (multi-edit). Reload for the eyes,
signal for the timing.

---

## Architecture (three pieces + a substrate)

**Substrate — [agent-browser](https://github.com/vercel-labs/agent-browser)** (Vercel, CLI on
Playwright/CDP). Gives Claude, for free: a persistent Chrome it drives and sees (snapshot + stable
element refs, annotated screenshots), session continuity across turns, real-Chrome-with-profile
mode so it sits on your dev server. Installs as a Claude Code skill — stays inside the terminal.
(Ignore its built-in `chat` REPL — that's the wrong layer; drive the plain CLI from Claude Code.)

**Piece 1 — Pointing overlay (you build).** Injected into your own page via the dev server.
The toggle, hover-highlight, click/select capture, the comment dialog, and the "?" marker +
throb + updating-overlay. Take the _feel_ from Agentation / the Codex browser as inspiration —
not as a dependency.

**Piece 2 — Element→source bridge (you build).** Resolves a clicked element / selected text to
`file:line` + selector using React + Vite's source data. Easy _because you own the source maps_.
This only works on your own dev server — not arbitrary live sites (which is fine; this is a dev
tool, not a site viewer — agent-browser already does generic browsing).

**Piece 3 — The seam / send + signal (you build).**
- **Send:** a small local daemon buffers the active note; a Claude Code `UserPromptSubmit`-style
  hook injects it into the session as real context (not a file Claude optionally reads, not MCP).
- **Signal back:** a `PostToolUse`/stop hook (or file-write hook) pings the daemon when Claude
  finishes → daemon tells the overlay → "?" clears / updating-overlay lifts.

---

## Open build risks (in priority order)

1. **Element→source resolution.** Make-or-break. Prototype this first in a throwaway React+Vite
   app: click a div, get `Component.tsx:line`. If this works cleanly, the rest is wiring.
2. **Note firing with zero terminal input.** The note auto-attaching to what you say is easy;
   making it drive Claude with _no_ terminal input at all pushes against how Claude Code takes
   input (it expects a prompt/lifecycle beat). Decide how far to push this — the back-and-forth
   model means you're usually typing anyway, so full zero-input may not even be needed for v1.
3. **The completion signal.** Verify the chosen hook actually fires where/when needed to clear
   the marker and lift the updating overlay.

---

## Hard boundary (acknowledged, not a problem)

The "click → exact source code" loop works **only on a dev server you own**, because the source
breadcrumbs that map a rendered element back to its code exist only in your own dev build. This is
a **development tool**, not a tool for annotating live websites you don't control. That's the
intended scope — so the boundary never bites.

---

## One-line summary

A persistent Chrome that Claude drives and sees (agent-browser) + a polished pointing overlay you
build on your own React+Vite page + a hook-based seam that carries your comment (with its real
source location) into the session and signals back to clear the marker — all summoned from and
reporting into the Claude Code terminal. Single transient "?" receipt, calm throb, clears when the
change becomes visible. A conversation with a visual channel.
