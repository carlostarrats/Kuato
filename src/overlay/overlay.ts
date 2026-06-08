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
// to type (terminal). A small card at the pin shows instruction copy + a Cancel button.
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
.vft-ui, .vft-ui * { box-sizing: border-box; }
.vft-toggle {
  position: fixed; bottom: 16px; right: 16px; z-index: ${Z};
  display: inline-flex; align-items: center; gap: 6px;
  font: 600 13px/1 ui-sans-serif, system-ui, -apple-system, sans-serif;
  padding: 8px 12px; border-radius: 8px; border: 0; cursor: pointer;
  background: #e5e7eb; color: #111827;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); pointer-events: auto;
}
.vft-toggle[aria-pressed="true"] { background: ${ACCENT}; color: #fff; }
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
.vft-card {
  position: fixed; width: 256px; z-index: ${Z}; pointer-events: auto;
  background: #fff; color: #374151; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.18);
  font: 400 14px/1.4 ui-sans-serif, system-ui, sans-serif;
}
.vft-card p { margin: 0; }
.vft-card .vft-actions { margin-top: 12px; display: flex; justify-content: flex-end; }
.vft-cancel {
  font: 500 13px/1 ui-sans-serif, system-ui, sans-serif;
  padding: 6px 10px; border-radius: 7px; border: 1px solid #d1d5db;
  background: #fff; color: #374151; cursor: pointer;
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

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "vft-toggle";
  toggleBtn.setAttribute("data-vft-toggle", "");
  toggleBtn.setAttribute("aria-pressed", "false");
  const toggleLabel = document.createElement("span");
  const renderToggle = () => {
    toggleBtn.setAttribute("aria-pressed", String(enabled));
    toggleLabel.textContent = enabled ? "Commenting" : "Comment";
  };
  toggleBtn.appendChild(svgPlus());
  toggleBtn.appendChild(toggleLabel);
  toggleBtn.addEventListener("click", () => {
    enabled = !enabled;
    if (!enabled) clearHighlight();
    renderToggle();
  });
  root.appendChild(toggleBtn);
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
    pin.wrap.style.top = `${r.top - 10}px`;
    pin.wrap.style.left = `${r.right - 14}px`;
    pin.card.style.top = `${r.bottom + 8}px`;
    pin.card.style.left = `${Math.max(8, r.left)}px`;
  }

  function removePin(): void {
    if (!pin) return;
    pin.wrap.remove();
    pin.card.remove();
    pin = null;
    window.removeEventListener("scroll", positionPin, true);
    window.removeEventListener("resize", positionPin);
  }

  function createPin(target: HTMLElement, selector: string): void {
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
    p.textContent =
      "Pinned. Now describe what you want changed here in the terminal — your next message to Claude applies to this element.";
    const actions = document.createElement("div");
    actions.className = "vft-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "vft-cancel";
    cancelBtn.setAttribute("data-vft-cancel", "");
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      removePin();
      onCancel();
    });
    actions.appendChild(cancelBtn);
    card.appendChild(p);
    card.appendChild(actions);

    root.appendChild(wrap);
    root.appendChild(card);
    pin = { target, selector, wrap, card };
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
    createPin(target, payload.selector);
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
