import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { resolveSource } from "../bridge/resolveSource";
import type { NotePayload } from "../note";

// The pointing overlay. Wraps your page and adds an annotate toggle, hover-highlight,
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
//
// Out of scope here (manual feel checkpoints): the marker's throb animation, the
// multi-edit "updating" overlay, and clear-on-reload timing.

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

export function AnnotationOverlay({ children, onPin, onCancel, clearSignal }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [pin, setPin] = useState<PinState | null>(null);
  const highlightedRef = useRef<HTMLElement | null>(null);

  // Seam: clear the pending marker when the completion signal arrives.
  useEffect(() => {
    if (!clearSignal) return;
    return clearSignal.subscribe(() => setPin(null));
  }, [clearSignal]);

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

      // Text selection → text pin (resolve from the selection's range). Otherwise the
      // clicked element → element pin.
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
      <button
        type="button"
        className="vft-toggle"
        data-vft-toggle=""
        aria-pressed={enabled}
        onClick={() => setEnabled((v) => !v)}
      >
        {enabled ? "Commenting" : "Comment"}
      </button>

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
          <div
            className="vft-marker"
            data-vft-marker=""
            data-vft-marker-selector={pin.selector}
            aria-label="Pinned — awaiting your request"
          >
            ?
          </div>

          {/* No text input — the comment is what you type in the terminal. This card
              just confirms the pin, says where to type, and offers an undo. */}
          <div className="vft-pin-card" role="status" data-vft-pin-card="">
            <p className="vft-pin-instruction">
              Pinned. Now describe what you want changed here in the terminal — your next
              message to Claude applies to this element.
            </p>
            <button
              type="button"
              className="vft-cancel"
              data-vft-cancel=""
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
