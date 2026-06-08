import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, cleanup, act } from "@testing-library/react";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { NoteDaemon } from "../daemon/NoteDaemon";

function Page() {
  return (
    <div className="page">
      <button type="button" className="page-action">
        Do the real thing
      </button>
    </div>
  );
}

function pin() {
  fireEvent.click(screen.getByText("Comment")); // enable comment mode
  fireEvent.click(screen.getByRole("button", { name: /do the real thing/i }));
}

describe("overlay clears the marker on the daemon's completion signal", () => {
  beforeEach(() => {
    cleanup();
    window.getSelection()?.removeAllRanges();
  });

  it("a completion signal from the daemon takes the marker present → absent", () => {
    const daemon = new NoteDaemon();
    render(
      <AnnotationOverlay onPin={(p) => daemon.setNote(p)} clearSignal={daemon}>
        <Page />
      </AnnotationOverlay>
    );

    pin();
    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(1);
    expect(daemon.getActiveNote()).not.toBeNull();

    // simulate the PostToolUse/stop signal hitting the daemon (Claude finished)
    act(() => {
      daemon.signalComplete();
    });

    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(0);
    expect(daemon.getActiveNote()).toBeNull();
  });

  it("no completion signal → the marker stays present (clears on result, not a timer)", () => {
    const daemon = new NoteDaemon();
    render(
      <AnnotationOverlay onPin={(p) => daemon.setNote(p)} clearSignal={daemon}>
        <Page />
      </AnnotationOverlay>
    );

    pin();
    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(1);
    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(1);
  });
});
