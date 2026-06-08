# Loop Task — Milestone 3: Pointing Overlay (mechanics only)

Build the overlay's testable mechanics. The *feel* of it — throb, friction, how the
marker breathes and vanishes — is NOT in this loop; that's a manual checkpoint you
judge by eye on the running page. Run with Claude Code on this file. Requires
Milestones 1 + 2 green.

---

## GOAL

An injected page overlay with working annotate mechanics:
- a connect/annotate TOGGLE (off by default; off = page behaves normally)
- hover-HIGHLIGHT of the element under the cursor while annotate mode is on
- CLICK capture (element note) and TEXT-SELECTION capture (text note)
- a comment DIALOG at the spot: comment field + Cancel + Comment(Connect)
- on Comment: drop a single "?" MARKER pinned to the target and emit a note payload
  (comment + resolved source location from the Milestone 2 bridge + selector/text)

## DONE WHEN

`npm test` passes, including tests that:
1. toggle OFF → a click triggers normal page behavior, no dialog, no capture.
2. toggle ON → hovering an element marks it as highlighted (assert the highlight
   state/attribute), and a click opens the dialog at that element.
3. typing a comment + Cancel → no marker, no payload, no trace.
4. typing a comment + Comment → exactly ONE marker exists, pinned to the target,
   and the emitted payload contains { comment, file, line, selector } (and `text`
   for a text-selection note), with file:line coming from the M2 bridge.
5. only ONE marker can exist at a time (a second note while one is pending is
   prevented or replaces — pick one, test it).

## LOOP

1. Run `npm test`. Read the full output.
2. All pass → output exactly `LOOP_DONE`, stop.
3. Else smallest change for the top failure, go to 1.

## STOP CONDITIONS (override the goal)

- Max 18 iterations (this one's bigger) → else `LOOP_STUCK` + blocker, stop.
- Same failure twice in a row → `LOOP_STUCK`, stop.
- Touch only `/src` (overlay code) and tests. No new packages / config without why.

## SCOPE GUARDS

- The marker is a "?" in a circle, ONE at a time, transient. Build it present/absent
  as state. Do NOT build the throb animation, the updating-overlay, or clear-on-reload
  timing here — those are Milestone 4 (signal) + manual feel checkpoints.
- The overlay must NOT send anything anywhere yet (no daemon). "Emit payload" means
  call an injectable callback / event the test can observe. Wiring it to the seam is
  Milestone 4.
- Use the real M2 bridge for location, not a stub, so payloads carry true file:line.

## VERIFICATION NOTES

- Test interactions with simulated events (fireEvent/userEvent), asserting state and
  payload — not pixels. Appearance is the manual checkpoint, not this loop's signal.
