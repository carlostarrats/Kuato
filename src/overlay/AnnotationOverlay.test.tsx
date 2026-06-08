import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { resolveSource } from "../bridge/resolveSource";

// A small known page rendered THROUGH the overlay. Because this .tsx is processed by
// @vitejs/plugin-react, its elements carry real dev source breadcrumbs, so the
// overlay's payloads resolve via the genuine M2 bridge (not a stub).
function Page({ onAction }: { onAction?: () => void }) {
  return (
    <div className="page">
      <button type="button" className="page-action" onClick={onAction}>
        Do the real thing
      </button>
      <p className="copy">
        Edit this <span className="word">phrase</span> please
      </p>
    </div>
  );
}

function enable() {
  fireEvent.click(screen.getByText("Comment"));
}

describe("Pin-only overlay (no comment box)", () => {
  beforeEach(() => {
    cleanup();
    window.getSelection()?.removeAllRanges();
  });

  it("toggle OFF: a click triggers normal page behavior, no pin, no marker, no payload", () => {
    const onPin = vi.fn();
    const onAction = vi.fn();
    render(
      <AnnotationOverlay onPin={onPin}>
        <Page onAction={onAction} />
      </AnnotationOverlay>
    );

    fireEvent.click(screen.getByRole("button", { name: /do the real thing/i }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onPin).not.toHaveBeenCalled();
    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(0);
  });

  it("toggle ON: hovering highlights the element", () => {
    render(
      <AnnotationOverlay onPin={vi.fn()}>
        <Page />
      </AnnotationOverlay>
    );
    enable();
    const target = screen.getByRole("button", { name: /do the real thing/i });
    fireEvent.mouseOver(target);
    expect(target).toHaveAttribute("data-vft-highlight");
  });

  it("clicking an element pins it immediately: marker + payload (no comment field), and NO comment box", () => {
    const onPin = vi.fn();
    render(
      <AnnotationOverlay onPin={onPin}>
        <Page />
      </AnnotationOverlay>
    );
    enable();

    const target = screen.getByRole("button", { name: /do the real thing/i });
    const expected = resolveSource(target)!;

    fireEvent.click(target);

    // pinned: exactly one marker, pinned to the clicked element
    const markers = document.querySelectorAll("[data-vft-marker]");
    expect(markers.length).toBe(1);
    expect(markers[0].getAttribute("data-vft-marker-selector")).toBe(expected.selector);
    expect(document.querySelector(expected.selector)).toBe(target);

    // payload carries WHERE only — no comment field, ever
    expect(onPin).toHaveBeenCalledTimes(1);
    const payload = onPin.mock.calls[0][0];
    expect(payload).toEqual({
      file: expected.file,
      line: expected.line,
      selector: expected.selector,
    });
    expect("comment" in payload).toBe(false);

    // there is NO text input / comment box in the browser
    expect(document.querySelector("textarea")).toBeNull();
    expect(document.querySelector('input[type="text"]')).toBeNull();
  });

  it("the pin card shows instruction copy pointing at the terminal, plus a Cancel button", () => {
    render(
      <AnnotationOverlay onPin={vi.fn()}>
        <Page />
      </AnnotationOverlay>
    );
    enable();
    fireEvent.click(screen.getByRole("button", { name: /do the real thing/i }));

    // self-explanatory for anyone: tells them to describe it in the terminal
    expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("Cancel un-pins: marker + card gone, and onCancel fires so the buffer clears", () => {
    const onPin = vi.fn();
    const onCancel = vi.fn();
    render(
      <AnnotationOverlay onPin={onPin} onCancel={onCancel}>
        <Page />
      </AnnotationOverlay>
    );
    enable();
    fireEvent.click(screen.getByRole("button", { name: /do the real thing/i }));
    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(0);
    expect(screen.queryByText(/terminal/i)).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("selecting text pins with the exact selected text in the payload", () => {
    const onPin = vi.fn();
    render(
      <AnnotationOverlay onPin={onPin}>
        <Page />
      </AnnotationOverlay>
    );
    enable();

    const word = document.querySelector("span.word") as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(word);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const expected = resolveSource(range)!;

    fireEvent.click(word);

    expect(onPin).toHaveBeenCalledTimes(1);
    expect(onPin.mock.calls[0][0]).toEqual({
      file: expected.file,
      line: expected.line,
      selector: expected.selector,
      text: word.textContent,
    });
  });

  it("only ONE pin at a time: a second click while one is pending is prevented", () => {
    const onPin = vi.fn();
    render(
      <AnnotationOverlay onPin={onPin}>
        <Page />
      </AnnotationOverlay>
    );
    enable();

    fireEvent.click(screen.getByRole("button", { name: /do the real thing/i }));
    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(1);

    const second = document.querySelector("span.word") as HTMLElement;
    fireEvent.click(second);

    expect(document.querySelectorAll("[data-vft-marker]").length).toBe(1);
    expect(onPin).toHaveBeenCalledTimes(1);
  });
});
