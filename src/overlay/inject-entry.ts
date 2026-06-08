import { mountOverlay } from "./overlay";

// esbuild IIFE entry. This is the single self-contained file the kuato skill injects
// (via agent-browser) into whatever page is in the browser. It mounts the overlay
// against the local daemon and guards against being injected twice into the same page.

declare global {
  interface Window {
    __kuatoOverlay?: { unmount(): void };
  }
}

if (!window.__kuatoOverlay) {
  window.__kuatoOverlay = mountOverlay({ daemonBase: "http://127.0.0.1:42100" });
  // eslint-disable-next-line no-console
  console.log("[kuato] overlay mounted — click Comment, then point at an element.");
}

export {};
