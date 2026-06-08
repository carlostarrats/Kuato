---
description: Start a Kuato visual-feedback session (daemon + dev server + browser)
---

Start a **Kuato visual-feedback session**. This is a deliberate, separate mode from
normal browser use — the daemon you start here is the on-switch that makes the
visual-feedback hooks live.

Do these steps, then hand control back to the user:

1. **Daemon** — if nothing is listening on port 42100, start it in the background:
   `npm run daemon`  (override port with `VFT_DAEMON_PORT`). Skip if already running.
2. **Dev server** — if http://localhost:5173 isn't already serving, start it in the
   background: `npm run dev`. Skip if already running.
3. **Browser** — open the app in real Chrome via agent-browser:
   `agent-browser open http://localhost:5173`. Take a snapshot to confirm it loaded.
4. **Tell the user it's ready**, in roughly these words:
   > Comment mode is ready. In the browser: click **Comment**, then click an element
   > (or select text) to pin it. Then just tell me here what you want changed — the
   > pinned element, its source location, and a screenshot come to me automatically.
   > The "?" marker clears when the change is live. One pin at a time.

For the rest of this session, treat it as a single back-and-forth visual-feedback loop:
- When a pin's context arrives alongside the user's message, act on THAT element:
  read the code at the pinned `file:line`, screenshot the element via agent-browser
  (using the pin's selector), make the change, and let Vite hot-reload.
- Don't queue or batch — one pin, one change, then the marker clears and it's their turn.
- To end the session, stop the daemon (and dev server) you started; that flips the
  feedback hooks back to no-ops.
