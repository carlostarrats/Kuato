import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountOverlay, type OverlayHandle } from "./overlay";
import { NoteDaemon } from "../daemon/NoteDaemon";

// The marker clears on RESULT (the daemon's completion signal), never on a timer.
// NoteDaemon structurally satisfies ClearSignal, so we drive the real thing.

let handle: OverlayHandle | null = null;

function pin(): void {
  (document.querySelector("[data-vft-toggle]") as HTMLElement).dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true })
  );
  document
    .querySelector(".page-action")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = `<button type="button" class="page-action">Do it</button>`;
});

afterEach(() => {
  handle?.unmount();
  handle = null;
});

describe("overlay clears the marker on the daemon's completion signal", () => {
  it("a completion signal takes the marker present → absent", () => {
    const daemon = new NoteDaemon();
    handle = mountOverlay({
      onPin: (p) => daemon.setNote(p),
      clearSignal: daemon,
    });

    pin();
    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(1);
    expect(daemon.getActiveNote()).not.toBeNull();

    daemon.signalComplete(); // Claude finished

    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(0);
    expect(daemon.getActiveNote()).toBeNull();
  });

  it("no completion signal → the marker stays present", () => {
    const daemon = new NoteDaemon();
    handle = mountOverlay({ onPin: (p) => daemon.setNote(p), clearSignal: daemon });

    pin();
    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(1);
    // no signal emitted
    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(1);
  });
});
