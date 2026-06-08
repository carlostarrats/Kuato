import type { NotePayload } from "../note";

// Milestone 4: the seam's core, transport-agnostic so it's trivially testable and the
// HTTP server / hooks are thin wrappers over it.
//
// SEND  — the overlay buffers the active note here; the UserPromptSubmit-style hook
//         reads `buildSubmitContext()` and injects it into the Claude Code session as
//         real context (not a file Claude optionally reads, not MCP).
// SIGNAL— the PostToolUse/stop hook calls `signalComplete()` when Claude finishes,
//         which clears the buffered note and notifies subscribers (the overlay) so the
//         "?" marker clears. It clears on RESULT, never on a timer.
//
// One active note at a time mirrors the overlay's one-marker rule.
export class NoteDaemon {
  private activeNote: NotePayload | null = null;
  private listeners = new Set<() => void>();

  /** Buffer the active note (overlay → daemon). Replaces any prior note: one at a time. */
  setNote(note: NotePayload): void {
    this.activeNote = note;
  }

  getActiveNote(): NotePayload | null {
    return this.activeNote;
  }

  hasNote(): boolean {
    return this.activeNote !== null;
  }

  /**
   * The context string the send hook injects into the session. It carries only the
   * WHERE (resolved source location + selector, plus selected text for a text pin) —
   * the comment is whatever the user typed in the terminal this turn. The pairing of
   * "their words" + "this code location" is the entire value. Null when nothing buffered.
   */
  buildSubmitContext(): string | null {
    const n = this.activeNote;
    if (!n) return null;
    const lines = [
      "[visual-feedback pin] The user pointed at an element in the browser; their",
      "request is the message they just typed in the terminal. Apply it here:",
      `location: ${n.file}:${n.line}`,
      `selector: ${n.selector}`,
    ];
    if (n.text !== undefined) {
      lines.push(`selected text: ${n.text}`);
    }
    return lines.join("\n");
  }

  /** Claude finished → clear the buffered pin and notify the overlay to clear "?". */
  signalComplete(): void {
    this.activeNote = null;
    for (const listener of this.listeners) listener();
  }

  /** Cancel (overlay Cancel button) → drop the buffer, but DON'T emit a completion
   * clear: cancelling is not a "Claude finished" event. The overlay removes its own
   * marker locally; this just makes sure no stale pin rides along the next prompt. */
  clearNote(): void {
    this.activeNote = null;
  }

  /** Subscribe to clear events (the overlay does this). Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
