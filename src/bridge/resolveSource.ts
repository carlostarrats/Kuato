// Milestone 1 + 2: the element→source bridge. Resolves a clicked DOM element OR a
// text selection back to the source location where its JSX is literally written.
// The location comes from the dev source breadcrumbs that @vitejs/plugin-react
// injects (the JSX `__source` data React stores on the fiber as `_debugSource`).
// This is NOT a hand-maintained component→location map — it reads the real
// breadcrumb off the rendered element. Both interaction types share one core.

export interface ElementSource {
  file: string;
  line: number;
  selector: string;
}

export interface SelectionSource extends ElementSource {
  text: string;
}

interface DebugSource {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

// React attaches its fiber to a DOM node under a key like "__reactFiber$<random>".
// (Older React used "__reactInternalInstance$".)
function getFiberFromNode(node: Node): any | null {
  const key = Object.keys(node).find(
    (k) =>
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactInternalInstance$")
  );
  return key ? (node as any)[key] : null;
}

// Walk up the fiber tree to the nearest fiber that carries a dev source breadcrumb.
function debugSourceFromFiber(fiber: any): DebugSource | null {
  let current = fiber;
  while (current) {
    if (current._debugSource && current._debugSource.fileName) {
      return current._debugSource as DebugSource;
    }
    current = current.return;
  }
  return null;
}

// Absolute dev paths → repo-relative "src/..." form (RelativePath/Component.tsx).
function toRelativeFile(fileName: string): string {
  const marker = "/src/";
  const idx = fileName.lastIndexOf(marker);
  if (idx !== -1) return "src/" + fileName.slice(idx + marker.length);
  return fileName.split("/").pop() ?? fileName;
}

// CORE (shared by element and selection paths): given a DOM element, find the
// nearest location breadcrumb, walking up DOM ancestors for elements that carry no
// fiber/source of their own (e.g. manually-injected nodes).
function locationForElement(
  element: HTMLElement
): { file: string; line: number } | null {
  let node: HTMLElement | null = element;
  while (node) {
    const fiber = getFiberFromNode(node);
    if (fiber) {
      const src = debugSourceFromFiber(fiber);
      if (src) {
        return { file: toRelativeFile(src.fileName), line: src.lineNumber };
      }
    }
    node = node.parentElement;
  }
  return null;
}

// Build a selector stable enough to re-find the element: id > unique class >
// nth-of-type path. This is for the note payload, not for styling.
function buildSelector(element: Element): string {
  const doc = element.ownerDocument;

  if (element.id) {
    const sel = `#${CSS.escape(element.id)}`;
    if (doc.querySelectorAll(sel).length === 1) return sel;
  }

  const tag = element.tagName.toLowerCase();
  for (const cls of Array.from(element.classList)) {
    const sel = `${tag}.${CSS.escape(cls)}`;
    if (doc.querySelectorAll(sel).length === 1) return sel;
  }

  // Fall back to a structural nth-of-type path up to a stable ancestor (id or body).
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== "html") {
    const current: Element = node;
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }
    let part = current.tagName.toLowerCase();
    const parent: HTMLElement | null = current.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current.tagName
      );
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(" > ");
}

// Normalize a Selection/Range anchor (often a text node) to its owning element.
function elementFromRangeStart(range: Range): HTMLElement | null {
  let node: Node | null = range.startContainer;
  if (node && node.nodeType !== Node.ELEMENT_NODE) {
    node = node.parentElement;
  }
  return (node as HTMLElement) ?? null;
}

function isRange(target: unknown): target is Range {
  return (
    typeof target === "object" &&
    target !== null &&
    "startContainer" in target &&
    "collapsed" in target
  );
}

function isSelection(target: unknown): target is Selection {
  return (
    typeof target === "object" &&
    target !== null &&
    "getRangeAt" in target &&
    "rangeCount" in target
  );
}

/**
 * Resolve a target to its source note payload.
 *
 * - HTMLElement → element note: `{ file, line, selector }`
 * - Selection / Range (a highlighted run of text) → text note:
 *   `{ file, line, selector, text }`, resolved from the selection's anchor element.
 *
 * Returns null if nothing in the chain carries a source breadcrumb.
 */
export function resolveSource(target: HTMLElement): ElementSource | null;
export function resolveSource(target: Selection | Range): SelectionSource | null;
export function resolveSource(
  target: HTMLElement | Selection | Range
): ElementSource | SelectionSource | null {
  // --- Text selection path (Selection or Range) ---
  if (isSelection(target) || isRange(target)) {
    const range = isSelection(target)
      ? target.rangeCount > 0
        ? target.getRangeAt(0)
        : null
      : target;
    if (!range) return null;

    const element = elementFromRangeStart(range);
    if (!element) return null;

    const location = locationForElement(element);
    if (!location) return null;

    return {
      ...location,
      selector: buildSelector(element),
      text: range.toString(),
    };
  }

  // --- Element path ---
  const location = locationForElement(target);
  if (!location) return null;
  return { ...location, selector: buildSelector(target) };
}
