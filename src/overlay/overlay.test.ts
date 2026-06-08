import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountOverlay, type OverlayHandle } from "./overlay";

// The overlay is now a standalone vanilla-DOM module injected onto WHATEVER page is in
// the browser. These tests render a plain-HTML page (no React, no fiber) and drive real
// DOM events — proof the overlay needs no framework on the host page.

let handle: OverlayHandle | null = null;

function setPage(): void {
  document.body.innerHTML = `
    <div class="page">
      <button type="button" class="page-action">Do the real thing</button>
      <p class="copy">Edit this <span class="word">phrase</span> please</p>
    </div>`;
}

function toggle(): HTMLElement {
  return document.querySelector("[data-vft-toggle]") as HTMLElement;
}

function enable(): void {
  toggle().dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function click(el: Element): boolean {
  return el.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true })
  );
}

beforeEach(() => {
  document.head.innerHTML = "";
  setPage();
  window.getSelection()?.removeAllRanges();
});

afterEach(() => {
  handle?.unmount();
  handle = null;
});

describe("standalone pin-only overlay (vanilla DOM, any framework)", () => {
  it("renders a Comment toggle and injects its styles once", () => {
    handle = mountOverlay({ onPin: vi.fn() });
    expect(toggle()).toBeTruthy();
    expect(toggle().textContent).toMatch(/comment/i);
    expect(document.querySelectorAll("#vft-overlay-style")).toHaveLength(1);
  });

  it("toggle OFF: a click runs normal page behavior, no pin/marker/payload", () => {
    const onPin = vi.fn();
    const onAction = vi.fn();
    handle = mountOverlay({ onPin });
    document
      .querySelector(".page-action")!
      .addEventListener("click", () => onAction());

    const notPrevented = click(document.querySelector(".page-action")!);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(true); // default not prevented when disabled
    expect(onPin).not.toHaveBeenCalled();
    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(0);
  });

  it("toggle ON: hovering highlights the element under the pointer", () => {
    handle = mountOverlay({ onPin: vi.fn() });
    enable();
    const target = document.querySelector(".page-action") as HTMLElement;
    target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(target).toHaveAttribute("data-vft-highlight");
  });

  it("clicking pins immediately: one marker + identity payload, no comment box", () => {
    const onPin = vi.fn();
    handle = mountOverlay({ onPin });
    enable();

    const target = document.querySelector(".page-action") as HTMLElement;
    const prevented = !click(target);

    expect(prevented).toBe(true); // annotate mode swallows the page action

    const markers = document.querySelectorAll("[data-vft-marker]");
    expect(markers).toHaveLength(1);
    const selector = markers[0].getAttribute("data-vft-marker-selector")!;
    expect(document.querySelector(selector)).toBe(target);

    expect(onPin).toHaveBeenCalledTimes(1);
    const payload = onPin.mock.calls[0][0];
    expect(payload.selector).toBe(selector);
    expect(payload.tag).toBe("button");
    expect(payload.text).toBe("Do the real thing");
    expect("comment" in payload).toBe(false);

    expect(document.querySelector("textarea")).toBeNull();
    expect(document.querySelector('input[type="text"]')).toBeNull();
  });

  it("the pin card points at the terminal and offers Cancel", () => {
    handle = mountOverlay({ onPin: vi.fn() });
    enable();
    click(document.querySelector(".page-action")!);

    const card = document.querySelector("[data-vft-pin-card]") as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.textContent?.toLowerCase()).toContain("terminal");
    expect(document.querySelector("[data-vft-cancel]")).toBeTruthy();
  });

  it("Cancel un-pins: marker + card gone and onCancel fires", () => {
    const onCancel = vi.fn();
    handle = mountOverlay({ onPin: vi.fn(), onCancel });
    enable();
    click(document.querySelector(".page-action")!);
    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(1);

    click(document.querySelector("[data-vft-cancel]")!);

    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(0);
    expect(document.querySelector("[data-vft-pin-card]")).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("clicking the overlay's own toggle never creates a pin", () => {
    const onPin = vi.fn();
    handle = mountOverlay({ onPin });
    enable(); // on
    enable(); // off again
    expect(onPin).not.toHaveBeenCalled();
    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(0);
  });

  it("selecting text pins with the exact selected run in the payload", () => {
    const onPin = vi.fn();
    handle = mountOverlay({ onPin });
    enable();

    const word = document.querySelector("span.word") as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(word);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    click(word);

    expect(onPin).toHaveBeenCalledTimes(1);
    const payload = onPin.mock.calls[0][0];
    expect(payload.selectedText).toBe("phrase");
    expect(document.querySelector(payload.selector)).toBe(word);
  });

  it("only ONE pin at a time: a second click while pending is prevented", () => {
    const onPin = vi.fn();
    handle = mountOverlay({ onPin });
    enable();

    click(document.querySelector(".page-action")!);
    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(1);

    click(document.querySelector("span.word")!);

    expect(document.querySelectorAll("[data-vft-marker]")).toHaveLength(1);
    expect(onPin).toHaveBeenCalledTimes(1);
  });

  it("unmount removes all overlay chrome and styles", () => {
    handle = mountOverlay({ onPin: vi.fn() });
    enable();
    click(document.querySelector(".page-action")!);
    handle.unmount();
    handle = null;

    expect(document.querySelector("[data-vft-toggle]")).toBeNull();
    expect(document.querySelector("[data-vft-marker]")).toBeNull();
    expect(document.querySelector("#vft-overlay-style")).toBeNull();
  });
});
