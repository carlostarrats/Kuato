import type { NotePayload } from "../note";
import type { ClearSignal } from "./AnnotationOverlay";

// Browser side of the seam. The overlay POSTs committed notes to the daemon and
// subscribes to its SSE "clear" stream, which the completion signal hook triggers.

const DEFAULT_BASE = "http://127.0.0.1:42100";

export function postNote(note: NotePayload, base: string = DEFAULT_BASE): void {
  // Fire-and-forget: the overlay's job is to attach the pin; the daemon buffers it
  // for the next prompt submit. Failures are non-fatal (daemon may not be running).
  void fetch(`${base}/note`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(note),
  }).catch(() => {});
}

// Cancel (overlay Cancel button) → drop the buffered pin so it doesn't ride along the
// next prompt. Fire-and-forget; the overlay already removed its marker locally.
export function cancelNote(base: string = DEFAULT_BASE): void {
  void fetch(`${base}/cancel`, { method: "POST" }).catch(() => {});
}

// A ClearSignal backed by the daemon's Server-Sent Events stream. The overlay clears
// its "?" marker whenever the daemon emits a "clear" event.
export function createDaemonClearSignal(base: string = DEFAULT_BASE): ClearSignal {
  return {
    subscribe(listener: () => void): () => void {
      const source = new EventSource(`${base}/events`);
      source.addEventListener("clear", () => listener());
      return () => source.close();
    },
  };
}
