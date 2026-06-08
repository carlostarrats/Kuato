// Framework-agnostic element capture. This REPLACES the React-only `resolveSource`
// (which read fiber `_debugSource` breadcrumbs to compute file:line). Instead of the
// browser computing a source location, it captures the element's *identity* as seen
// in the DOM — text, attributes, a robust selector, surrounding context — and Claude,
// already running in the repo, finds the source by searching. Works on React, Vue,
// Svelte, Next, or plain HTML, because it only reads what's rendered.
//
// A React `_debugSource` breadcrumb, when present, rides along as an OPTIONAL fast-path
// hint (`source`) — never required, never throws when absent.

import type { CapturedElement } from "../note";

const TEXT_CAP = 200;
const SNIPPET_CAP = 400;
const ANCESTOR_CAP = 120;

// Attributes worth carrying as search discriminators. `data-*` is always included on
// top of this list; id/class/style are handled separately (id + classes fields) or
// deliberately dropped (style is noise).
const ATTR_WHITELIST = new Set([
  "aria-label",
  "role",
  "title",
  "href",
  "alt",
  "placeholder",
  "name",
  "type",
  "for",
]);

function cap(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) : t;
}

// ── Selector (re-find anchor; also the screenshot anchor) ────────────────────
// id > unique tag.class > structural nth-of-type path up to a stable ancestor.
export function buildSelector(element: Element): string {
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

// ── Optional React source fast-path ──────────────────────────────────────────
interface DebugSource {
  fileName: string;
  lineNumber: number;
}

function getFiberFromNode(node: Node): any | null {
  const key = Object.keys(node).find(
    (k) =>
      k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
  );
  return key ? (node as any)[key] : null;
}

function toRelativeFile(fileName: string): string {
  const marker = "/src/";
  const idx = fileName.lastIndexOf(marker);
  if (idx !== -1) return "src/" + fileName.slice(idx + marker.length);
  return fileName.split("/").pop() ?? fileName;
}

// Best-effort: walk up DOM ancestors, and at each, up the fiber tree, looking for a
// `_debugSource`. Returns undefined when nothing carries one (the common case off React).
function debugSourceHint(
  element: HTMLElement
): { file: string; line: number } | undefined {
  let node: HTMLElement | null = element;
  while (node) {
    let fiber = getFiberFromNode(node);
    while (fiber) {
      const src = fiber._debugSource as DebugSource | undefined;
      if (src && src.fileName) {
        return { file: toRelativeFile(src.fileName), line: src.lineNumber };
      }
      fiber = fiber.return;
    }
    node = node.parentElement;
  }
  return undefined;
}

// ── Surrounding context ──────────────────────────────────────────────────────
const SECTIONING = new Set([
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "NAV",
  "MAIN",
  "ASIDE",
  "FORM",
  "FIELDSET",
]);

// Nearest meaningful label for the element's region: an ancestor's aria-label, or the
// heading/legend/label inside the nearest sectioning ancestor. Helps disambiguate
// elements whose own text is generic ("Submit", "Buy").
function ancestorText(element: HTMLElement): string | undefined {
  for (
    let a: HTMLElement | null = element.parentElement;
    a && a !== document.body && a.nodeType === 1;
    a = a.parentElement
  ) {
    const label = a.getAttribute("aria-label");
    if (label && label.trim()) return cap(label, ANCESTOR_CAP);
    if (SECTIONING.has(a.tagName)) {
      const heading = a.querySelector("h1,h2,h3,h4,h5,h6,legend,label");
      const ht = heading?.textContent;
      if (ht && ht.trim()) return cap(ht, ANCESTOR_CAP);
    }
  }
  return undefined;
}

function curatedAttrs(element: HTMLElement): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith("data-") || ATTR_WHITELIST.has(attr.name)) {
      out[attr.name] = attr.value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

// outerHTML with child subtrees collapsed to the element's text — enough to recognise
// the element's own markup without dumping a whole subtree.
function htmlSnippet(element: HTMLElement): string {
  const shallow = element.cloneNode(false) as HTMLElement;
  shallow.textContent = cap(element.textContent ?? "", ANCESTOR_CAP);
  return cap(shallow.outerHTML, SNIPPET_CAP);
}

function visibleText(element: HTMLElement): string | undefined {
  const t = cap(element.innerText ?? element.textContent ?? "", TEXT_CAP);
  return t || undefined;
}

// ── Public API ───────────────────────────────────────────────────────────────
export function captureElement(element: HTMLElement): CapturedElement {
  const classes = Array.from(element.classList);
  const result: CapturedElement = {
    selector: buildSelector(element),
    tag: element.tagName.toLowerCase(),
  };
  if (element.id) result.id = element.id;
  if (classes.length) result.classes = classes;

  const text = visibleText(element);
  if (text) result.text = text;

  const attrs = curatedAttrs(element);
  if (attrs) result.attrs = attrs;

  const snippet = htmlSnippet(element);
  if (snippet) result.outerHTMLSnippet = snippet;

  const near = ancestorText(element);
  if (near) result.ancestorText = near;

  const source = debugSourceHint(element);
  if (source) result.source = source;

  return result;
}

function isSelection(t: unknown): t is Selection {
  return (
    typeof t === "object" &&
    t !== null &&
    "getRangeAt" in t &&
    "rangeCount" in t
  );
}

export function captureSelection(
  target: Selection | Range
): CapturedElement | null {
  const range = isSelection(target)
    ? target.rangeCount > 0
      ? target.getRangeAt(0)
      : null
    : target;
  if (!range) return null;

  let anchor: Node | null = range.startContainer;
  if (anchor && anchor.nodeType !== Node.ELEMENT_NODE) {
    anchor = anchor.parentElement;
  }
  if (!anchor) return null;

  const captured = captureElement(anchor as HTMLElement);
  const selectedText = cap(range.toString(), TEXT_CAP);
  if (selectedText) captured.selectedText = selectedText;
  return captured;
}
