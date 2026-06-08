import { describe, it, expect, beforeEach } from "vitest";
import {
  captureElement,
  captureSelection,
  buildSelector,
} from "./captureContext";

// These tests run on PLAIN HTML fixtures — no React, no @vitejs/plugin-react, no
// fiber. That is the point: capture must work on whatever is in the browser. The
// React fast-path is exercised by faking a fiber on a bare DOM node (no render).

function setBody(html: string): void {
  document.body.innerHTML = html;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("captureElement — framework-agnostic identity", () => {
  it("captures tag, id, classes, visible text and a unique selector", () => {
    setBody(`<button id="buy" class="cta primary">Subscribe now</button>`);
    const el = document.getElementById("buy") as HTMLElement;

    const cap = captureElement(el);

    expect(cap.tag).toBe("button");
    expect(cap.id).toBe("buy");
    expect(cap.classes).toEqual(["cta", "primary"]);
    expect(cap.text).toBe("Subscribe now");
    expect(cap.selector).toBe(buildSelector(el));
    expect(document.querySelectorAll(cap.selector)).toHaveLength(1);
    expect(document.querySelector(cap.selector)).toBe(el);
  });

  it("captures a curated attribute whitelist (data-*, aria-label, href…) but not class/style", () => {
    setBody(
      `<a href="/pricing" aria-label="See pricing" data-testid="price-link"
          role="link" title="Pricing" class="nav-link" style="color:red">Pricing</a>`
    );
    const el = document.querySelector("a") as HTMLElement;

    const cap = captureElement(el);

    expect(cap.attrs).toMatchObject({
      href: "/pricing",
      "aria-label": "See pricing",
      "data-testid": "price-link",
      role: "link",
      title: "Pricing",
    });
    expect(cap.attrs).not.toHaveProperty("class");
    expect(cap.attrs).not.toHaveProperty("style");
  });

  it("derives ancestorText from an aria-labelled ancestor", () => {
    setBody(
      `<section aria-label="Pricing"><div><button>Buy</button></div></section>`
    );
    const el = document.querySelector("button") as HTMLElement;

    expect(captureElement(el).ancestorText).toBe("Pricing");
  });

  it("derives ancestorText from a heading inside the nearest section", () => {
    setBody(`<section><h2>Plans</h2><button>Buy</button></section>`);
    const el = document.querySelector("button") as HTMLElement;

    expect(captureElement(el).ancestorText).toBe("Plans");
  });

  it("includes an outerHTML snippet with child subtrees collapsed", () => {
    setBody(`<button class="cta" data-testid="sub">Subscribe now</button>`);
    const el = document.querySelector("button") as HTMLElement;

    expect(captureElement(el).outerHTMLSnippet).toBe(
      `<button class="cta" data-testid="sub">Subscribe now</button>`
    );
  });

  it("disambiguates duplicated text via distinct selectors and attrs", () => {
    setBody(`
      <form><button data-testid="login">Submit</button></form>
      <form><button data-testid="signup">Submit</button></form>
    `);
    const [first, second] = Array.from(
      document.querySelectorAll("button")
    ) as HTMLElement[];

    const a = captureElement(first);
    const b = captureElement(second);

    expect(a.text).toBe("Submit");
    expect(b.text).toBe("Submit");
    // identical text, but the discriminators differ and each selector is unique
    expect(a.selector).not.toBe(b.selector);
    expect(a.attrs?.["data-testid"]).toBe("login");
    expect(b.attrs?.["data-testid"]).toBe("signup");
    expect(document.querySelector(a.selector)).toBe(first);
    expect(document.querySelector(b.selector)).toBe(second);
  });

  it("omits the React source hint on a plain element (no fiber)", () => {
    setBody(`<button>Plain</button>`);
    const el = document.querySelector("button") as HTMLElement;

    expect(captureElement(el).source).toBeUndefined();
  });

  it("includes the React source fast-path when a _debugSource fiber is present", () => {
    setBody(`<button>React</button>`);
    const el = document.querySelector("button") as HTMLElement;
    // Simulate what @vitejs/plugin-react leaves on the DOM node — no real render.
    (el as any)["__reactFiber$test"] = {
      _debugSource: {
        fileName: "/Users/me/proj/src/components/Foo.tsx",
        lineNumber: 42,
      },
      return: null,
    };

    expect(captureElement(el).source).toEqual({
      file: "src/components/Foo.tsx",
      line: 42,
    });
  });
});

describe("captureSelection — text-selection pins", () => {
  it("captures the highlighted run plus the anchor element identity", () => {
    setBody(`<p class="lead">hello <em>world</em> again</p>`);
    const em = document.querySelector("em") as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(em);

    const cap = captureSelection(range);

    expect(cap).not.toBeNull();
    expect(cap!.selectedText).toBe("world");
    expect(cap!.tag).toBe("em");
    expect(document.querySelector(cap!.selector)).toBe(em);
  });
});
