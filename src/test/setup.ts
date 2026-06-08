import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Vanilla-DOM tests — no React. Reset the document between tests so overlay chrome and
// injected styles never leak across cases.
afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});
