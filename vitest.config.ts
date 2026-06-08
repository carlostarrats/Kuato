/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

// No @vitejs/plugin-react — the tool no longer depends on React or the JSX dev-source
// transform. Tests run on plain-HTML jsdom fixtures, which is itself proof that capture
// and the overlay need no framework on the host page.
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
