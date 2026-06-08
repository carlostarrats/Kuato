import { DEFAULT_DAEMON_PORT, startDaemon } from "./server.js";

// Standalone daemon runner (live wiring). Run via: npm run daemon
const port = Number(process.env.VFT_DAEMON_PORT ?? DEFAULT_DAEMON_PORT);
startDaemon(port);
// eslint-disable-next-line no-console
console.log(`[visual-feedback] daemon listening on http://127.0.0.1:${port}`);
