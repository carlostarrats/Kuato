# Loop Task — Milestone 2: Element → Source Bridge (integrated)

Promote the Milestone 1 prototype into a real, reusable bridge module. Adds text-
selection resolution to the element-click resolution Milestone 1 already proved.
Run with Claude Code pointed at this file; let its built-in loop iterate. Requires
Milestone 1 green first.

---

## GOAL

A single bridge module that resolves BOTH interaction types to source:
- an element click → `{ file, line, selector }`
- a text selection (user highlights words) → `{ file, line, selector, text }`
…using the `@vitejs/plugin-react` dev source breadcrumbs (NOT a hand-maintained map).

## DONE WHEN

`npm test` passes, including tests that:
1. (carried from M1) click on a nested element resolves to its real `file:line`.
2. a text selection inside a known element resolves to that element's real
   `file:line`, returns a CSS selector that uniquely matches the element, and
   returns the exact selected `text`.
3. resolving an element with no own breadcrumb walks up to the nearest ancestor
   that has one (no crash, returns the ancestor's location).

## LOOP

1. Run `npm test`. Read the full output.
2. If all tests pass, output exactly `LOOP_DONE` and stop.
3. Otherwise make the smallest change addressing the top failure, then go to 1.

## STOP CONDITIONS (override the goal)

- Max 15 iterations → else `LOOP_STUCK` + blocker summary, stop.
- Same test failing the same way twice → `LOOP_STUCK`, stop.
- Touch only `/src` and tests. No new packages / config changes without stating why.

## SCOPE GUARDS

- Expose one module: `resolveSource(target)` where target is an HTMLElement OR a
  Selection/Range. Element → element note shape; Selection → text-selection note shape.
- Selector must be stable enough to re-find the element (id > unique class > nth-of-type
  path). The selector is for the note payload, not styling.
- Still NO overlay UI, NO daemon, NO marker. This is the bridge only.
- Reuse, don't fork, the M1 resolution logic — text-selection resolution should call
  the same breadcrumb-reading core, just starting from the selection's anchor node.

## VERIFICATION NOTES

- A text selection's anchor is often a text node — resolve from its parent element.
- Keep assertions exact on file:line. Don't relax to substring matching to pass.
