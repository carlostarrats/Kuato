#!/usr/bin/env node
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ KUATO VISUAL-FEEDBACK TOOL — added by Claude. Safe to delete to uninstall.│
// │ Removal: see docs/KUATO-FOOTPRINT.md (also unhook it from .claude/        │
// │ settings.json → hooks.UserPromptSubmit).                                  │
// └─────────────────────────────────────────────────────────────────────────┘
// Claude Code UserPromptSubmit hook (SEND half of the seam).
//
// On every prompt submit it asks the daemon for the buffered active note and, if there
// is one, injects it into the session as real context via the UserPromptSubmit
// `additionalContext` field. The note rides along with whatever you typed — its job is
// to silently attach the WHERE (file:line) and the code to your words.
//
// Wire it in .claude/settings.json:
//   { "hooks": { "UserPromptSubmit": [
//       { "hooks": [ { "type": "command",
//         "command": "node /ABS/PATH/hooks/send-note.mjs" } ] } ] } }
//
// Zero-terminal-input firing is intentionally NOT attempted here (spec build risk #2 /
// by-hand decision): this assumes the note rides along with a normal prompt submit.

const PORT = process.env.VFT_DAEMON_PORT ?? "42100";

try {
  const res = await fetch(`http://127.0.0.1:${PORT}/note`);
  if (res.ok) {
    const { context } = await res.json();
    if (context) {
      // Preferred structured form: Claude Code merges additionalContext into the session.
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            additionalContext: context,
          },
        })
      );
    }
  }
} catch {
  // Daemon not running → no note to inject; submit proceeds normally.
}
process.exit(0);
