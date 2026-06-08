import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { App } from "../App";
import { resolveSource } from "./resolveSource";

// Read the real App.tsx source and find the literal line a piece of JSX is written
// on. This keeps the assertion honest (it tracks the actual file) without a fragile
// hardcoded number: if the element moves, the expected line moves with it.
// (jsdom makes import.meta.url an http URL, so resolve from the project cwd instead.)
const appSourcePath = resolve(process.cwd(), "src/App.tsx");
const appSource = readFileSync(appSourcePath, "utf8").split("\n");

function lineContaining(snippet: string): number {
  const idx = appSource.findIndex((l) => l.includes(snippet));
  if (idx === -1) throw new Error(`snippet not found in App.tsx: ${snippet}`);
  return idx + 1; // 1-based, matches dev source breadcrumbs
}

describe("Milestone 1 (carried): element → source", () => {
  beforeEach(() => cleanup());

  it("resolves a clicked nested element to its ACTUAL src file and line", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /nested button/i });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    fireEvent.click(button);

    const call = logSpy.mock.calls.find((c) => c[0] === "resolveSource:");
    expect(call, "App should log the resolved source on click").toBeTruthy();
    const result = call![1];
    logSpy.mockRestore();

    expect(result).toMatchObject({
      file: "src/App.tsx",
      line: lineContaining('<button type="button"'),
    });
  });

  it("resolves a directly-passed nested element to its real file:line", () => {
    render(<App />);
    const span = document.querySelector("span.accent") as HTMLElement;
    expect(span).toBeTruthy();

    const result = resolveSource(span);
    expect(result).toMatchObject({
      file: "src/App.tsx",
      line: lineContaining('<span className="accent">'),
    });
  });
});

describe("Milestone 2: integrated bridge", () => {
  beforeEach(() => cleanup());

  it("element note carries a selector that uniquely matches the element", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /nested button/i });

    const result = resolveSource(button);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      file: "src/App.tsx",
      line: lineContaining('<button type="button"'),
    });
    // selector must re-find exactly this element
    const matches = document.querySelectorAll(result!.selector!);
    expect(matches.length).toBe(1);
    expect(matches[0]).toBe(button);
    // an element note has no `text`
    expect((result as any).text).toBeUndefined();
  });

  it("text selection resolves to the element's file:line + selector + exact text", () => {
    render(<App />);
    const span = document.querySelector("span.accent") as HTMLElement;
    expect(span).toBeTruthy();

    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const result = resolveSource(selection);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      file: "src/App.tsx",
      line: lineContaining('<span className="accent">'),
      text: span.textContent,
    });
    const matches = document.querySelectorAll(result!.selector!);
    expect(matches.length).toBe(1);
    expect(matches[0]).toBe(span);
  });

  it("also accepts a bare Range (not only a Selection)", () => {
    render(<App />);
    const span = document.querySelector("span.accent") as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(span);

    const result = resolveSource(range);
    expect(result).toMatchObject({
      file: "src/App.tsx",
      line: lineContaining('<span className="accent">'),
      text: span.textContent,
    });
  });

  it("an element with no own breadcrumb walks up to the nearest ancestor that has one", () => {
    render(<App />);
    const span = document.querySelector("span.accent") as HTMLElement;
    // A manually-created node has no React fiber / source breadcrumb of its own.
    const orphan = document.createElement("em");
    orphan.textContent = "no breadcrumb here";
    span.appendChild(orphan);

    const result = resolveSource(orphan);
    expect(result).not.toBeNull();
    // resolves to the span's real location, not a crash and not null
    expect(result).toMatchObject({
      file: "src/App.tsx",
      line: lineContaining('<span className="accent">'),
    });
  });
});
