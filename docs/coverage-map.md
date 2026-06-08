# Coverage Map — Visual Feedback Tool spec → build plan

Every section of the spec, marked as one of:
- **[LOOP n]** — has an objective pass/fail signal; gets a loop file.
- **[CHECKPOINT]** — feel/taste; you judge it by eye between loops. Not loopable.
- **[BY HAND]** — a decision or setup that fights automation; do it manually.

---

## Substrate: agent-browser
**[BY HAND]** — install the Vercel agent-browser Claude Code skill, confirm it
drives a real Chrome on your dev server. Setup + visual confirmation, not a
testable build artifact. Done once, before the loops that depend on it (Loop 4).

## Stack: React + Vite
Not a task — a constraint that every loop inherits.

## Build risk #1 / Element→source resolution
**[LOOP 1]** — already written. Click → `file:line`, proven by test.

## Piece 2: Element→source bridge (integrated)
**[LOOP 2]** — promote the Loop 1 prototype into a real module that also resolves
*text selections* to `file:line` + selector, not just element clicks. Testable.

## Piece 1: Pointing overlay
Splits — it's too big for one pass/fail signal:
- **[LOOP 3]** — mechanics: annotate toggle, hover-highlight, click + text-select
  capture, the comment dialog (field + Cancel + Comment). Testable via simulated
  interaction: toggle on → click → dialog appears → comment captured with location.
- **[CHECKPOINT]** — the marker's throb, dialog friction, "lands cleanly," the
  breathing-then-vanish feel. You watch the running page. No loop.

## Piece 3: The seam (send + signal)
- **[LOOP 4]** — the daemon + `UserPromptSubmit` hook (note → session context) and
  the `PostToolUse`/stop hook (Claude done → daemon → overlay clears "?"). Testable:
  fire a note, assert it lands in session context; fire completion, assert the
  clear-ping is received.
- **[CHECKPOINT]** — single-edit "?" clear-on-reload vs multi-edit "updating"
  overlay timing. Whether resolution feels honest/snappy. Eye, not test.

## Build risk #2 / Note firing with ZERO terminal input
**[BY HAND]** — spec says it fights Claude Code's input lifecycle and may not be
needed for v1. Decide how far to push; do not loop it.

## Resolution / marker timing rules
Covered partly by Loop 4 (the signal plumbing) and partly by the CHECKPOINT above
(does the timing *feel* right). No separate loop.

---

## Tally
- Loops: **4** (Loop 1 done; 2, 3, 4 below).
- Manual checkpoints: overlay feel, seam/marker timing.
- By hand: agent-browser setup, zero-input decision.

Loops cover all of the doc that has an objective pass/fail signal. The checkpoints
and by-hand items are the rest of the doc — real work, just not loop-shaped.
