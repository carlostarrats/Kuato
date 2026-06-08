/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// React + Vite is the load-bearing stack choice (see spec). The whole tool rests
// on @vitejs/plugin-react emitting dev source-location breadcrumbs, so we keep the
// plugin active in the test environment too (vitest runs through Vite's transform
// pipeline in "serve" mode, where the JSX source transform is enabled).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
