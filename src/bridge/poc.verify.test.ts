import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { captureElement } from "./captureContext";
import { NoteDaemon } from "../daemon/NoteDaemon";

// PROOF-OF-CONCEPT for the whole rework: capture an element rendered by a NON-React
// page, then show the captured identity locates the exact source line by SEARCH across
// frameworks (plain HTML, Svelte, Vue) — no React fiber, no file:line breadcrumb.
//
// This is the load-bearing premise ("search replaces the breadcrumb"), checked
// automatically. If this is green, framework-independence holds.

const ex = (p: string) => resolve(process.cwd(), "examples", p);
const read = (p: string) => readFileSync(ex(p), "utf8");

// Stand-in for "Claude searches the repo" — ripgrep-equivalent line match.
function findLines(fileText: string, needle: string): number[] {
  return fileText
    .split("\n")
    .map((line, i) => (line.includes(needle) ? i + 1 : -1))
    .filter((n) => n !== -1);
}

beforeEach(() => {
  document.documentElement.innerHTML = read("static/index.html").replace(
    /<!doctype[^>]*>/i,
    ""
  );
});

describe("POC: framework-agnostic capture → search locates source", () => {
  it("captures a plain-HTML element with NO source breadcrumb", () => {
    const el = document.querySelector(
      'section[aria-label="Pricing"] button'
    ) as HTMLElement;

    const cap = captureElement(el);

    expect(cap.text).toBe("Subscribe now");
    expect(cap.attrs?.["data-testid"]).toBe("sub-cta");
    expect(cap.ancestorText).toBe("Pricing");
    expect(cap.source).toBeUndefined(); // no React → no breadcrumb, and that's fine

    // the injected context tells Claude to search, and carries no false location
    const d = new NoteDaemon();
    d.setNote(cap);
    const ctx = d.buildSubmitContext()!;
    expect(ctx.toLowerCase()).toContain("search");
    expect(ctx.toLowerCase()).not.toContain("source hint");
  });

  it("text alone is ambiguous, but the captured discriminator locates the exact line in non-React source", () => {
    const el = document.querySelector(
      'section[aria-label="Pricing"] button'
    ) as HTMLElement;
    const cap = captureElement(el);

    const html = read("static/index.html");
    const svelte = read("svelte/Pricing.svelte");
    const vue = read("vue/Pricing.vue");

    // visible text alone matches TWO buttons in the HTML — not enough on its own
    expect(findLines(html, cap.text!).length).toBe(2);

    // the captured data-testid discriminator pins exactly one line — in EVERY framework
    const testid = cap.attrs!["data-testid"];
    for (const [name, src] of [
      ["svelte", svelte],
      ["vue", vue],
    ] as const) {
      const hits = findLines(src, testid);
      expect(hits, `${name} should have one match`).toHaveLength(1);
      const line = src.split("\n")[hits[0] - 1];
      expect(line).toContain("Subscribe now"); // the discriminator lands on the button
    }
  });
});
