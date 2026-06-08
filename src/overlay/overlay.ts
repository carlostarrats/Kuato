import { captureElement, captureSelection } from "../bridge/captureContext";
import type { NotePayload } from "../note";
import {
  postNote,
  cancelNote,
  createDaemonClearSignal,
  type ClearSignal,
} from "./daemonClient";

// The pointing overlay, as a STANDALONE vanilla-DOM module. It is injected onto whatever
// page is in the browser — the user's own running dev server, any framework — so it must
// not assume React, Tailwind, or anything about the host page. It adds a Comment toggle,
// hover-highlight, and click/text-select capture. There is intentionally NO comment box:
// clicking (or selecting text) PINS the spot — it drops a single "?" marker and emits the
// captured element identity via `onPin`. You then describe what you want in the TERMINAL;
// the daemon attaches this pin to that message. One place to point (browser), one place
// to type (terminal). A toast confirms the pin; the Comment toggle itself flips to a black
// "Cancel" button (no separate control) to drop the pin or stop commenting.
// `clearSignal` — driven by the daemon when Claude finishes — clears the marker on RESULT.

export interface MountOptions {
  /** Daemon base URL; defaults to the local daemon. Used for the default transport. */
  daemonBase?: string;
  /** Override the pin sink (defaults to POSTing to the daemon). Injectable for tests. */
  onPin?: (note: NotePayload) => void;
  /** Override cancel (defaults to telling the daemon to drop the buffered pin). */
  onCancel?: () => void;
  /** Override the completion signal (defaults to the daemon's SSE stream). */
  clearSignal?: ClearSignal;
}

export interface OverlayHandle {
  unmount(): void;
}

// Sit above virtually any app chrome.
const Z = 2147483000;
const STYLE_ID = "vft-overlay-style";

// Self-contained styles — no host CSS variables, no Tailwind. The accent is hardcoded so
// the marker pulse + hover highlight look right on any page.
const ACCENT = "#6366f1";
const overlayCss = `
[data-vft-highlight] {
  outline: 2px solid ${ACCENT};
  outline-offset: 2px;
  border-radius: 3px;
  cursor: crosshair;
}
@keyframes vft-throb {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.75); opacity: 0; }
}
/* The toggle pulses an expanding accent ring while commenting is OFF, to invite a
   click; the ring stops the moment it's pressed. Base drop shadow is preserved in
   every keyframe so it never flickers. */
@keyframes vft-toggle-pulse {
  0%   { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 rgba(99,102,241,0.55); }
  70%  { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 12px rgba(99,102,241,0); }
  100% { box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 rgba(99,102,241,0); }
}
.vft-ui, .vft-ui * { box-sizing: border-box; }
/* A single button lives in the bottom-right dock. It is the Comment toggle when
   commenting is off and becomes the black Cancel control when it's on — there is no
   separate Cancel button, so the two states never compete for the same job. */
.vft-dock {
  position: fixed; bottom: 16px; right: 16px; z-index: ${Z};
  display: flex; flex-direction: column; align-items: stretch; gap: 8px;
  pointer-events: none;
}
.vft-toggle {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font: 600 13px/1 ui-sans-serif, system-ui, -apple-system, sans-serif;
  /* min-width holds the wider "Comment" footprint so the button doesn't resize when it
     flips to the shorter "Cancel" label. */
  min-width: 108px;
  padding: 8px 12px; border-radius: 8px; border: 0; cursor: pointer;
  background: #e5e7eb; color: #111827;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); pointer-events: auto;
  transition: background 150ms ease;
}
/* The plus rotates 45° into an X when the button flips to Cancel. */
.vft-toggle svg { transition: transform 150ms ease; }
.vft-toggle[aria-pressed="false"] {
  animation: vft-toggle-pulse 2s ease-out infinite;
}
.vft-toggle[aria-pressed="false"]:hover { background: #d1d5db; }
.vft-toggle[aria-pressed="true"] { background: #111827; color: #fff; }
.vft-toggle[aria-pressed="true"]:hover { background: #374151; }
.vft-toggle[aria-pressed="true"] svg { transform: rotate(45deg); }
@media (prefers-reduced-motion: reduce) {
  .vft-toggle[aria-pressed="false"] { animation: none; }
  .vft-toggle svg { transition: none; }
}
.vft-marker-wrap { position: fixed; width: 24px; height: 24px; z-index: ${Z}; pointer-events: none; }
.vft-throb {
  position: absolute; inset: 0; border-radius: 9999px; background: ${ACCENT};
  animation: vft-throb 2.4s ease-in-out infinite;
}
.vft-marker {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  border-radius: 9999px; background: ${ACCENT}; color: #fff;
  font: 600 13px/1 ui-sans-serif, system-ui, sans-serif;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
/* The pin confirmation is a toast: pinned to the bottom-center, sitting safely above
   the Comment toggle so the two never overlap. Fades in while rising, fades back down
   on the way out. The translate(-50%) keeps it centered through the whole animation. */
@keyframes vft-toast-in {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes vft-toast-out {
  from { opacity: 1; transform: translate(-50%, 0); }
  to   { opacity: 0; transform: translate(-50%, 12px); }
}
.vft-card {
  position: fixed; bottom: 66px; left: 50%; transform: translateX(-50%);
  z-index: ${Z}; pointer-events: auto;
  max-width: min(90vw, 460px);
  display: flex; align-items: center; gap: 14px;
  background: ${ACCENT}; color: #fff; border-radius: 10px;
  padding: 12px 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  font: 500 13px/1.45 ui-sans-serif, system-ui, -apple-system, sans-serif;
  animation: vft-toast-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.vft-card--leaving { animation: vft-toast-out 200ms ease-in both; }
.vft-card p { margin: 0; }
@media (prefers-reduced-motion: reduce) {
  .vft-card, .vft-card--leaving { animation: none; }
}
`;

function svgPlus(): SVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  for (const d of ["M12 5v14", "M5 12h14"]) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

interface PinState {
  target: HTMLElement;
  selector: string;
  wrap: HTMLElement;
  card: HTMLElement;
  // Where the user clicked, stored as an offset from the target's top-left so the
  // marker rides along with the element on scroll/resize instead of snapping to a corner.
  offsetX: number;
  offsetY: number;
}

export function mountOverlay(opts: MountOptions = {}): OverlayHandle {
  const base = opts.daemonBase;
  const onPin = opts.onPin ?? ((n: NotePayload) => postNote(n, base));
  const onCancel = opts.onCancel ?? (() => cancelNote(base));
  const clearSignal = opts.clearSignal ?? createDaemonClearSignal(base);

  let enabled = false;
  let pin: PinState | null = null;
  let highlighted: HTMLElement | null = null;

  // Inject self-contained styles once.
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = overlayCss;
    document.head.appendChild(style);
  }

  // All overlay chrome lives under one root tagged data-vft-ui, so event handlers can
  // tell the overlay's own UI apart from the host page.
  const root = document.createElement("div");
  root.className = "vft-ui";
  root.setAttribute("data-vft-ui", "");
  document.body.appendChild(root);

  // Bottom-right dock holds the single Comment/Cancel toggle.
  const dock = document.createElement("div");
  dock.className = "vft-dock";
  dock.setAttribute("data-vft-ui", "");
  root.appendChild(dock);

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "vft-toggle";
  toggleBtn.setAttribute("data-vft-toggle", "");
  toggleBtn.setAttribute("aria-pressed", "false");
  const toggleLabel = document.createElement("span");
  const renderToggle = () => {
    toggleBtn.setAttribute("aria-pressed", String(enabled));
    // While commenting is on the toggle IS the cancel control (black, "Cancel"); the
    // plus rotates into an X via CSS. There is no separate Cancel button.
    toggleLabel.textContent = enabled ? "Cancel" : "Comment";
  };
  toggleBtn.appendChild(svgPlus());
  toggleBtn.appendChild(toggleLabel);
  toggleBtn.addEventListener("click", () => {
    enabled = !enabled;
    if (!enabled) {
      // Turning commenting off also drops any live pin (the button doubles as Cancel).
      clearHighlight();
      if (pin) {
        removePin();
        onCancel();
      }
    }
    renderToggle();
  });
  dock.appendChild(toggleBtn);
  renderToggle();

  function isOverlayUi(node: EventTarget | null): boolean {
    return (
      node instanceof Element && !!node.closest("[data-vft-ui]")
    );
  }

  function clearHighlight(): void {
    if (highlighted) {
      highlighted.removeAttribute("data-vft-highlight");
      highlighted = null;
    }
  }

  function positionPin(): void {
    if (!pin) return;
    const r = pin.target.getBoundingClientRect();
    // Anchor the marker on the exact clicked point (clamped inside the element so it
    // can't drift outside if the element later shrinks). The wrap is 24×24, so offset
    // by 12 to center the "?" on the point rather than hang it off the corner.
    const offsetX = Math.max(0, Math.min(pin.offsetX, r.width));
    const offsetY = Math.max(0, Math.min(pin.offsetY, r.height));
    const x = r.left + offsetX;
    const y = r.top + offsetY;
    pin.wrap.style.top = `${y - 12}px`;
    pin.wrap.style.left = `${x - 12}px`;
    // The toast is a fixed bottom-center element (positioned purely in CSS), so it is
    // intentionally NOT tied to the element's box — only the marker tracks the element.
  }

  function removePin(): void {
    if (!pin) return;
    const { wrap, card } = pin;
    pin = null;
    window.removeEventListener("scroll", positionPin, true);
    window.removeEventListener("resize", positionPin);
    // The marker goes at once; the toast plays its fade-out, then unmounts. A timeout
    // backstops the case where animationend never fires (reduced motion, background tab).
    wrap.remove();
    let removed = false;
    const finish = (): void => {
      if (removed) return;
      removed = true;
      card.remove();
    };
    card.addEventListener("animationend", finish, { once: true });
    card.classList.add("vft-card--leaving");
    setTimeout(finish, 400);
  }

  function createPin(
    target: HTMLElement,
    selector: string,
    clientX: number,
    clientY: number,
  ): void {
    const r0 = target.getBoundingClientRect();
    const offsetX = clientX - r0.left;
    const offsetY = clientY - r0.top;
    const wrap = document.createElement("div");
    wrap.className = "vft-marker-wrap";
    wrap.setAttribute("data-vft-ui", "");
    const throb = document.createElement("span");
    throb.className = "vft-throb";
    throb.setAttribute("aria-hidden", "true");
    const marker = document.createElement("div");
    marker.className = "vft-marker";
    marker.setAttribute("data-vft-marker", "");
    marker.setAttribute("data-vft-marker-selector", selector);
    marker.setAttribute("aria-label", "Pinned — awaiting your request");
    marker.textContent = "?";
    wrap.appendChild(throb);
    wrap.appendChild(marker);

    const card = document.createElement("div");
    card.className = "vft-card";
    card.setAttribute("data-vft-ui", "");
    card.setAttribute("data-vft-pin-card", "");
    card.setAttribute("role", "status");
    const p = document.createElement("p");
    p.textContent = "Comment in your terminal to make any edits.";
    card.appendChild(p);

    root.appendChild(wrap);
    root.appendChild(card);
    pin = { target, selector, wrap, card, offsetX, offsetY };
    positionPin();
    window.addEventListener("scroll", positionPin, true);
    window.addEventListener("resize", positionPin);
  }

  function onMouseOver(e: MouseEvent): void {
    if (!enabled) return;
    const t = e.target;
    // Moving onto our own chrome, the bare page root, or a non-element → drop any
    // highlight rather than leaving it stuck or outlining the whole page.
    if (
      !(t instanceof HTMLElement) ||
      isOverlayUi(t) ||
      t === document.body ||
      t === document.documentElement
    ) {
      clearHighlight();
      return;
    }
    if (t === highlighted) return;
    clearHighlight();
    t.setAttribute("data-vft-highlight", "");
    highlighted = t;
  }

  function onClick(e: MouseEvent): void {
    if (!enabled) return;
    if (isOverlayUi(e.target)) return; // let the toggle/cancel run normally

    // Annotate mode: clicks become pin targets, never normal page actions.
    e.preventDefault();
    e.stopPropagation();

    if (pin) return; // one pin at a time

    const selection = window.getSelection();
    const hasTextSelection =
      !!selection && selection.rangeCount > 0 && !selection.isCollapsed;

    let target = e.target as HTMLElement;
    let payload: NotePayload | null = null;

    if (hasTextSelection) {
      const range = selection!.getRangeAt(0).cloneRange();
      let anchor: Node | null = range.startContainer;
      if (anchor && anchor.nodeType !== Node.ELEMENT_NODE) {
        anchor = anchor.parentElement;
      }
      if (anchor) {
        target = anchor as HTMLElement;
        payload = captureSelection(range);
      }
    } else {
      payload = captureElement(target);
    }

    if (!payload) return;

    onPin(payload);
    clearHighlight();
    createPin(target, payload.selector, e.clientX, e.clientY);
  }

  // Capture phase so we win over the host page's own handlers.
  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("click", onClick, true);

  const unsubscribe = clearSignal.subscribe(() => removePin());

  return {
    unmount() {
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", positionPin, true);
      window.removeEventListener("resize", positionPin);
      unsubscribe();
      clearHighlight();
      removePin();
      root.remove();
      document.getElementById(STYLE_ID)?.remove();
    },
  };
}
