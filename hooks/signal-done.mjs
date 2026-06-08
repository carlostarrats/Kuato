#!/usr/bin/env node
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ KUATO VISUAL-FEEDBACK TOOL — added by Claude. Safe to delete to uninstall.│
// │ Removal: see docs/KUATO-FOOTPRINT.md (also unhook it from .claude/        │
// │ settings.json → hooks.Stop).                                             │
// └─────────────────────────────────────────────────────────────────────────┘
// Claude Code Stop hook (SIGNAL-BACK half of the seam).
//
// Fires when Claude finishes its turn. It pings the daemon's /complete endpoint; the
// daemon clears the buffered note and pushes a "clear" event over SSE to the overlay,
// which removes the "?" marker. The marker thus clears on RESULT (after the edit + Vite
// reload have made the change visible), not at edit start — keeping it honest.
//
// Wire it in .claude/settings.json:
//   { "hooks": { "Stop": [
//       { "hooks": [ { "type": "command",
//         "command": "node /ABS/PATH/hooks/signal-done.mjs" } ] } ] } }
//
// Note (spec build risk #3): verify this hook actually fires on completion in your
// setup. If a different lifecycle event is needed, point that event at this script.

const PORT = process.env.VFT_DAEMON_PORT ?? "42100";

try {
  await fetch(`http://127.0.0.1:${PORT}/complete`, { method: "POST" });
} catch {
  // Daemon not running → nothing to signal.
}
process.exit(0);
