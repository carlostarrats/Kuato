# Loop Task — Milestone 1: Element → Source Resolution

This is the first and load-bearing milestone from the Visual Feedback Tool spec
("Open build risks" #1). Build the smallest thing that proves a clicked element
resolves to its real source location. No overlay, no marker, no daemon yet.

Run this with Claude Code pointed at this file. Let Claude's built-in agentic loop
do the edit → test → read → retry cycle. Do not build an external controller.

---

## GOAL

A fresh React + Vite app where clicking any rendered element in the browser
resolves to its source location, formatted as `RelativePath/Component.tsx:line`,
proven by an automated test.

## STACK (from the spec — do not substitute)

- React + Vite, using `@vitejs/plugin-react`.
- Resolution MUST come from the plugin's built-in dev source-location data
  (the `__source` / `data-source`-style JSX dev breadcrumbs that carry
  `fileName` and `lineNumber`). Do NOT hand-maintain a component→location map.
  The whole tool rests on these being real source breadcrumbs, so a fake or
  hardcoded mapping is a failed milestone even if the test passes.

## DONE WHEN

`npm test` passes, including a test that:
1. Renders a known component tree containing at least one nested element.
2. Simulates a click on that nested element.
3. Asserts the resolver returns the element's ACTUAL source file and line —
   i.e. the file and line where that JSX element is literally written in /src.

## LOOP

1. Run `npm test`. Read the full output.
2. If all tests pass, output exactly `LOOP_DONE` and stop.
3. Otherwise, make the smallest change that addresses the top failure, then go to 1.

## STOP CONDITIONS (these override the goal)

- Maximum 15 iterations. If not done by then, output `LOOP_STUCK` followed by a
  short summary of what is blocking, and stop. Do not keep trying past the cap.
- If the same test fails the same way twice in a row, stop with `LOOP_STUCK` —
  do not repeat an approach that is not working.
- Touch only files under `/src` and the test files. Do not install packages or
  change build config without first stating in your output why it is required.

## SCOPE GUARDS

- Build ONLY click-to-source. No annotate toggle, no hover highlight, no comment
  dialog, no "?" marker, no daemon, no Claude Code hooks. Those are later milestones.
- The resolver should expose a single function, e.g.
  `resolveSource(element: HTMLElement): { file: string; line: number } | null`,
  that reads the dev source breadcrumb off the clicked element (walking up to the
  nearest ancestor that carries one, if the exact target has none).
- A click handler in the app wires a click anywhere to `resolveSource` and logs
  the result, so the behavior is observable in the browser too — but the test,
  not the log, is the success signal.

## VERIFICATION NOTES

- The test asserts against the real file:line, so update the expected values if you
  move the component. Don't loosen the assertion to a substring match just to pass —
  that defeats the milestone.
- Confirm the dev transform that emits source locations is actually active in the
  test environment; if jsdom/test mode strips it, that's the real problem to solve,
  not the assertion.
