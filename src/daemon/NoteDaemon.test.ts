import { describe, it, expect } from "vitest";
import { NoteDaemon } from "./NoteDaemon";
import type { NotePayload } from "../note";

// A framework-agnostic pin: the browser captured WHAT was pointed at (identity), not a
// source location. Claude resolves it to source by searching the repo.
const note: NotePayload = {
  selector: "button.cta",
  tag: "button",
  text: "Subscribe now",
  attrs: { "data-testid": "sub-cta", "aria-label": "Subscribe" },
  ancestorText: "Pricing",
  outerHTMLSnippet: `<button class="cta" data-testid="sub-cta">Subscribe now</button>`,
};

describe("NoteDaemon (pin + signal contract)", () => {
  it("builds search-instruction context from the captured identity (no comment field)", () => {
    const d = new NoteDaemon();
    d.setNote(note);

    const ctx = d.buildSubmitContext();
    expect(ctx).not.toBeNull();
    // the captured identity Claude searches by
    expect(ctx).toContain("button");
    expect(ctx).toContain("Subscribe now");
    expect(ctx).toContain("button.cta");
    expect(ctx).toContain("data-testid");
    expect(ctx).toContain("Pricing");
    // the comment is the user's terminal message — the context must make that clear
    expect(ctx!.toLowerCase()).toContain("terminal");
    // it must tell Claude to LOCATE the source itself (search), not expect file:line
    expect(ctx!.toLowerCase()).toContain("search");
  });

  it("includes the selected text for a text-selection pin", () => {
    const d = new NoteDaemon();
    d.setNote({ ...note, selectedText: "phrase to change" });
    expect(d.buildSubmitContext()).toContain("phrase to change");
  });

  it("includes an optional source hint ONLY when a React breadcrumb is present", () => {
    const d = new NoteDaemon();

    d.setNote(note); // no source
    const without = d.buildSubmitContext()!;
    expect(without.toLowerCase()).not.toContain("source hint");

    d.setNote({ ...note, source: { file: "src/App.tsx", line: 20 } });
    const withHint = d.buildSubmitContext()!;
    expect(withHint).toContain("src/App.tsx");
    expect(withHint).toContain("20");
    expect(withHint.toLowerCase()).toContain("source hint");
    expect(withHint.toLowerCase()).toContain("verify"); // don't blindly trust a stale breadcrumb
  });

  it("buffers EXACTLY ONE active pin at a time (latest replaces)", () => {
    const d = new NoteDaemon();
    d.setNote(note);
    d.setNote({ ...note, selector: "section.panel" });

    const active = d.getActiveNote();
    expect(active).toEqual({ ...note, selector: "section.panel" });
    expect(Array.isArray(active)).toBe(false);
  });

  it("no active pin → submit context is null (nothing to inject)", () => {
    const d = new NoteDaemon();
    expect(d.buildSubmitContext()).toBeNull();
    expect(d.getActiveNote()).toBeNull();
  });

  it("completion signal clears the active pin AND emits a clear event", () => {
    const d = new NoteDaemon();
    d.setNote(note);

    let cleared = 0;
    const unsub = d.subscribe(() => (cleared += 1));
    d.signalComplete();

    expect(cleared).toBe(1);
    expect(d.getActiveNote()).toBeNull();
    unsub();
  });

  it("clearNote() (cancel) drops the buffer WITHOUT emitting a completion clear", () => {
    const d = new NoteDaemon();
    d.setNote(note);

    let cleared = 0;
    d.subscribe(() => (cleared += 1));
    d.clearNote();

    expect(d.getActiveNote()).toBeNull();
    expect(cleared).toBe(0); // cancel is not a "Claude finished" event
  });

  it("does not emit a clear event on its own (clears on result, not a timer)", () => {
    const d = new NoteDaemon();
    d.setNote(note);
    let cleared = 0;
    d.subscribe(() => (cleared += 1));

    expect(cleared).toBe(0);
    expect(d.getActiveNote()).toEqual(note);
  });
});
