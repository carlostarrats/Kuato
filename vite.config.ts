/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// React + Vite is the load-bearing stack choice (see spec). The whole tool rests
// on @vitejs/plugin-react emitting dev source-location breadcrumbs, so we keep the
// plugin active in the test environment too (vitest runs through Vite's transform
// pipeline in "serve" mode, where the JSX source transform is enabled).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
