import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Bundle the standalone overlay into one self-contained IIFE. This single file is what
// the kuato skill injects (via agent-browser) into whatever page is in the browser —
// no imports at runtime, no React, no framework assumptions about the host page.
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(repo, "src/overlay/inject-entry.ts")],
  outfile: join(repo, "dist/overlay/kuato-overlay.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2019"],
  minify: true,
});

console.log("built dist/overlay/kuato-overlay.js");
