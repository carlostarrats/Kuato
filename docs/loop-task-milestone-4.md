# Loop Task — Milestone 4: The Seam (send + signal back)

Wire the overlay to Claude Code: note → session context, and Claude-done → clear the
marker. This is the daemon + hooks. Requires Milestones 1–3 green AND the agent-browser
substrate set up by hand first. The *timing feel* (single-edit snap vs multi-edit
"updating" overlay) is a manual checkpoint, not this loop's signal.

---

## GOAL

A local daemon + Claude Code hooks that close the round trip:
- SEND: a `UserPromptSubmit`-style hook injects the buffered active note into the
  session as real context (not a file Claude optionally reads, not MCP).
- SIGNAL BACK: a `PostToolUse`/stop (or file-write) hook pings the daemon when Claude
  finishes → daemon tells the overlay → the "?" marker clears.

## DONE WHEN

`npm test` (and any integration script the tests invoke) passes, including:
1. a note buffered in the daemon is injected into the session payload by the send
   hook — assert the note's { comment, file, line, selector } appears in the
   submitted context.
2. exactly one active note is buffered at a time (matches the overlay's one-marker rule).
3. a simulated completion signal hitting the signal hook causes the daemon to emit a
   clear event the overlay receives — assert the overlay's marker goes from present
   to absent on that event.
4. no completion signal → marker stays present (it clears on result, not on a timer).

## LOOP

1. Run `npm test`. Read the full output.
2. All pass → output exactly `LOOP_DONE`, stop.
3. Else smallest change for the top failure, go to 1.

## STOP CONDITIONS (override the goal)

- Max 18 iterations → else `LOOP_STUCK` + blocker summary, stop.
- Same failure twice in a row → `LOOP_STUCK`, stop.
- Touch only the daemon code, hook scripts, overlay wiring, and tests. No new packages
  / config changes without first stating why.

## SCOPE GUARDS

- Do NOT attempt zero-terminal-input firing here — the spec marks that as fighting
  Claude Code's input lifecycle and maybe unneeded for v1. This milestone assumes the
  note rides along with a normal prompt submit. The zero-input push is a by-hand
  decision, explicitly out of scope.
- The signal clears the marker on RESULT (after the reload makes the change visible),
  not at edit start — keep the clear honest.
- Build the clear logic; do NOT build the multi-edit "updating" overlay timing or the
  throb here. Those are manual feel checkpoints once the plumbing is proven.
- Mock the Claude Code hook invocations in tests — you're proving the daemon/overlay
  contract, not driving a live session inside the test.

## VERIFICATION NOTES

- Verify the chosen hook actually fires where/when assumed (spec build risk #3). If the
  real hook doesn't fire on completion as expected, THAT is the blocker to surface as
  `LOOP_STUCK`, not the daemon logic.
- After this loop is green, do the manual checkpoint: run it live, watch a single edit
  clear on reload and a multi-edit run, and judge whether the timing feels honest and
  snappy before building the "updating" overlay + throb.
