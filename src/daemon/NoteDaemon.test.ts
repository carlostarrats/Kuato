import { describe, it, expect } from "vitest";
import { NoteDaemon } from "./NoteDaemon";
import type { NotePayload } from "../note";

const note: NotePayload = {
  file: "src/App.tsx",
  line: 20,
  selector: "button.cta",
};

describe("NoteDaemon (pin + signal contract)", () => {
  it("buffers a pin and builds submit context with location + selector (no comment field)", () => {
    const d = new NoteDaemon();
    d.setNote(note);

    const ctx = d.buildSubmitContext();
    expect(ctx).not.toBeNull();
    expect(ctx).toContain("src/App.tsx");
    expect(ctx).toContain("20");
    expect(ctx).toContain("button.cta");
    // the comment is the user's terminal message — the context must make that clear
    expect(ctx!.toLowerCase()).toContain("terminal");
  });

  it("includes the selected text for a text-selection pin", () => {
    const d = new NoteDaemon();
    d.setNote({ ...note, text: "phrase" });
    expect(d.buildSubmitContext()).toContain("phrase");
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
