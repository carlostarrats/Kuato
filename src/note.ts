// Shared note shape — what the overlay PINS and the daemon buffers/injects.
// Kept framework-free (plain DOM facts) so the Node daemon can import it without
// pulling in the overlay, and so it works for ANY app in the browser.
//
// Note: there is NO `comment` field. By design the comment is what you type to Claude
// in the terminal; the pin only carries the identity of WHAT you pointed at. The
// terminal message + this pin ride together — one place to type (the terminal), one
// place to point (the browser).
//
// There is also NO required `file`/`line`. The browser captures the element's identity
// as rendered; Claude — already running in the repo — resolves it to source by
// searching. A React `_debugSource` breadcrumb, when present, rides along as an
// OPTIONAL fast-path hint (`source`); it is never required.
export interface CapturedElement {
  /** Robust CSS selector — re-finds the element and anchors the agent-browser screenshot. */
  selector: string;
  /** Lowercase tag name, e.g. "button". */
  tag: string;
  id?: string;
  classes?: string[];
  /** Trimmed visible text — the primary search key. */
  text?: string;
  /** The highlighted run, for text-selection pins only. */
  selectedText?: string;
  /** Curated search discriminators: data-*, aria-label, role, title, href, alt, placeholder, name, type, for. */
  attrs?: Record<string, string>;
  /** outerHTML with child subtrees collapsed (capped). */
  outerHTMLSnippet?: string;
  /** Nearest section/heading/label text, to disambiguate generic text. */
  ancestorText?: string;
  /** OPTIONAL React fast-path; present only when a dev `_debugSource` breadcrumb exists. */
  source?: { file: string; line: number };
}

export type NotePayload = CapturedElement;
