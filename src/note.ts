// Shared note shape — what the overlay PINS and the daemon buffers/injects.
// Kept React-free so the Node daemon can import it without pulling in the overlay.
//
// Note: there is NO `comment` field. By design the comment is what you type to Claude
// in the terminal; the pin only carries the WHERE (resolved source location + selector,
// plus the exact text for a text selection). The terminal message + this pin ride
// together — one place to type (the terminal), one place to point (the browser).
export interface NotePayload {
  file: string;
  line: number;
  selector: string;
  text?: string;
}
