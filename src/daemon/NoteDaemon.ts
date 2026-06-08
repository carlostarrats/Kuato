import type { NotePayload } from "../note.js";

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
   * The context string the send hook injects into the session. It carries the captured
   * IDENTITY of the element the user pointed at (text, attrs, selector, surrounding
   * context) — NOT a source location. The comment is whatever the user typed in the
   * terminal this turn. Claude, already running in the repo, locates the source itself
   * by searching for that identity — which is what makes this framework-agnostic (works
   * on React, Vue, Svelte, Next, or plain HTML). A React `_debugSource` breadcrumb, when
   * present, rides along as an optional fast-path hint to verify, never to trust blindly.
   * Null when nothing buffered.
   */
  buildSubmitContext(): string | null {
    const n = this.activeNote;
    if (!n) return null;

    const lines = [
      "[kuato pin] The user pointed at an element in the browser. Their request is the",
      "message they just typed in the terminal — apply it to THIS element.",
      "",
      "Locate the source yourself (works for any framework — search the repo for the",
      "captured text / attributes / id, then confirm the match renders this element):",
      `  tag: ${n.tag}`,
    ];

    if (n.text) lines.push(`  text: ${JSON.stringify(n.text)}`);
    lines.push(`  selector: ${n.selector}   # also use this to screenshot the element`);
    if (n.id) lines.push(`  id: ${n.id}`);
    if (n.classes?.length) lines.push(`  classes: ${n.classes.join(" ")}`);
    if (n.attrs && Object.keys(n.attrs).length) {
      const attrs = Object.entries(n.attrs)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(" ");
      lines.push(`  attrs: ${attrs}`);
    }
    if (n.ancestorText) lines.push(`  near: ${JSON.stringify(n.ancestorText)}`);
    if (n.outerHTMLSnippet) lines.push(`  html: ${n.outerHTMLSnippet}`);
    if (n.selectedText) {
      lines.push(`  selected text: ${JSON.stringify(n.selectedText)}`);
    }
    if (n.source) {
      lines.push(
        `  source hint (verify before trusting): ${n.source.file}:${n.source.line}`
      );
    }

    lines.push(
      "",
      "To find it: search (ripgrep) for the visible text / key attrs / id, then narrow.",
      "To see it: screenshot via agent-browser using the selector above. Then make the",
      'change; the dev server hot-reloads and the "?" marker clears when you finish.'
    );

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
