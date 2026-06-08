import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { MessageSquarePlus } from "lucide-react";
import { resolveSource } from "../bridge/resolveSource";
import type { NotePayload } from "../note";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// The pointing overlay. Wraps your page and adds a Comment toggle, hover-highlight,
// and click/text-select capture. There is intentionally NO comment box: clicking (or
// selecting text) PINS the spot — it drops a single "?" marker and emits the pin's
// source location via `onPin`. You then describe what you want in the TERMINAL; the
// daemon attaches this pin to that message. One place to point (browser), one place to
// type (terminal).
//
// A small card at the pin shows instruction copy + a Cancel button (so it's
// self-explanatory and you can un-pin a misclick). `onCancel` lets the host drop the
// buffered pin. `clearSignal` — a tiny pub/sub the daemon drives when Claude finishes —
// clears the marker on RESULT (never on a timer).

export type { NotePayload };

// The overlay subscribes to this; the daemon emits when the change has become visible,
// clearing the pending marker. Structurally satisfied by NoteDaemon.
export interface ClearSignal {
  subscribe(listener: () => void): () => void;
}

interface PinState {
  target: HTMLElement;
  selector: string;
}

interface Props {
  children: ReactNode;
  onPin: (payload: NotePayload) => void;
  onCancel?: () => void;
  clearSignal?: ClearSignal;
}

// Sit above virtually any app chrome.
const Z = 2147483000;

// Self-contained styles so the marker pulse + hover highlight work regardless of the
// host page's CSS (the highlight lands on the host's own elements).
const overlayCss = `
[data-vft-highlight] {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 3px;
  cursor: crosshair;
}
@keyframes vft-throb {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.75); opacity: 0; }
}
`;

export function AnnotationOverlay({ children, onPin, onCancel, clearSignal }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [pin, setPin] = useState<PinState | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const highlightedRef = useRef<HTMLElement | null>(null);

  // Inject the overlay's self-contained styles once, into <head>, so they don't show
  // up in the page's content/accessibility tree.
  useEffect(() => {
    const id = "vft-overlay-style";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = overlayCss;
    document.head.appendChild(el);
  }, []);

  // Seam: clear the pending marker when the completion signal arrives.
  useEffect(() => {
    if (!clearSignal) return;
    return clearSignal.subscribe(() => setPin(null));
  }, [clearSignal]);

  // Keep the marker + card glued to the element as the page scrolls or resizes.
  useEffect(() => {
    if (!pin) {
      setRect(null);
      return;
    }
    const update = () => setRect(pin.target.getBoundingClientRect());
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [pin]);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.removeAttribute("data-vft-highlight");
      highlightedRef.current = null;
    }
  }, []);

  const handleMouseOver = useCallback(
    (e: ReactMouseEvent) => {
      if (!enabled) return;
      const t = e.target as HTMLElement;
      if (!(t instanceof HTMLElement) || t === highlightedRef.current) return;
      clearHighlight();
      t.setAttribute("data-vft-highlight", "");
      highlightedRef.current = t;
    },
    [enabled, clearHighlight]
  );

  const handleClickCapture = useCallback(
    (e: ReactMouseEvent) => {
      if (!enabled) return;

      // Annotate mode: clicks become pin targets, never normal page actions.
      e.preventDefault();
      e.stopPropagation();

      // One pin at a time: while a pin is pending, block starting another.
      if (pin) return;

      const selection = window.getSelection();
      const hasTextSelection =
        !!selection && selection.rangeCount > 0 && !selection.isCollapsed;

      let target: HTMLElement = e.target as HTMLElement;
      let location: NotePayload | null = null;

      if (hasTextSelection) {
        const range = selection!.getRangeAt(0).cloneRange();
        let anchor: Node | null = range.startContainer;
        if (anchor && anchor.nodeType !== Node.ELEMENT_NODE) {
          anchor = anchor.parentElement;
        }
        if (anchor) {
          target = anchor as HTMLElement;
          location = resolveSource(range);
        }
      } else {
        location = resolveSource(target);
      }

      if (!location) return;

      onPin(location);
      clearHighlight();
      setPin({ target, selector: location.selector });
    },
    [enabled, pin, onPin, clearHighlight]
  );

  const cancel = useCallback(() => {
    setPin(null);
    onCancel?.();
  }, [onCancel]);

  return (
    <div className="vft-root">
      <Button
        type="button"
        size="sm"
        variant={enabled ? "default" : "secondary"}
        className="fixed bottom-4 right-4 gap-1.5 shadow-lg"
        style={{ zIndex: Z }}
        data-vft-toggle=""
        aria-pressed={enabled}
        onClick={() => setEnabled((v) => !v)}
      >
        <MessageSquarePlus className="size-4" />
        {enabled ? "Commenting" : "Comment"}
      </Button>

      <div
        className="vft-page"
        data-vft-annotate={enabled ? "on" : "off"}
        onMouseOverCapture={handleMouseOver}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>

      {pin && (
        <>
          {/* "?" marker pinned to the element, with a slow calm pulse behind it. */}
          <div
            className="pointer-events-none fixed"
            style={{
              zIndex: Z,
              top: (rect?.top ?? 0) - 10,
              left: (rect?.right ?? 0) - 14,
              width: 24,
              height: 24,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary"
              style={{ animation: "vft-throb 2.4s ease-in-out infinite" }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
              style={{ fontSize: 13, fontWeight: 600 }}
              data-vft-marker=""
              data-vft-marker-selector={pin.selector}
              aria-label="Pinned — awaiting your request"
            >
              ?
            </div>
          </div>

          {/* No text input — the comment is what you type in the terminal. This card
              just confirms the pin, says where to type, and offers an undo. */}
          <Card
            className="fixed w-64 gap-0 p-3 shadow-xl"
            style={{
              zIndex: Z,
              top: (rect?.bottom ?? 0) + 8,
              left: Math.max(8, rect?.left ?? 0),
            }}
            role="status"
            data-vft-pin-card=""
          >
            <p className="text-sm leading-snug text-muted-foreground">
              Pinned. Now describe what you want changed here in the terminal — your next
              message to Claude applies to this element.
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-vft-cancel=""
                onClick={cancel}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
