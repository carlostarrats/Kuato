import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { NotePayload } from "../note.js";
import { NoteDaemon } from "./NoteDaemon.js";

// Milestone 4: thin HTTP wrapper over NoteDaemon. These are the surfaces the Claude
// Code hooks and the browser overlay actually talk to:
//
//   POST /note      overlay → buffer the active pin
//   GET  /note      send hook → { note, context } to inject into the session
//   POST /complete  signal hook → Claude finished; clear the pin + notify overlay
//   POST /cancel    overlay Cancel → drop the buffered pin (no completion event)
//   GET  /events    overlay → Server-Sent Events stream; emits "clear" on completion
//
// The default port mirrors the spec's local daemon (kept here for the live wiring).
export const DEFAULT_DAEMON_PORT = 42100;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

export function createDaemonServer(daemon: NoteDaemon): Server {
  return createServer(async (req, res) => {
    const { method } = req;
    const url = (req.url ?? "/").split("?")[0];

    try {
      // CORS preflight: the overlay is injected into the user's app (some other port)
      // and POSTs cross-origin to this daemon. A JSON POST is "non-simple", so the
      // browser sends an OPTIONS preflight first — answer it or every POST is blocked.
      if (method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        });
        res.end();
        return;
      }

      if (method === "POST" && url === "/note") {
        const raw = await readBody(req);
        const note = JSON.parse(raw) as NotePayload;
        daemon.setNote(note);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "GET" && url === "/note") {
        sendJson(res, 200, {
          note: daemon.getActiveNote(),
          context: daemon.buildSubmitContext(),
        });
        return;
      }

      if (method === "POST" && url === "/complete") {
        daemon.signalComplete();
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "POST" && url === "/cancel") {
        daemon.clearNote();
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "GET" && url === "/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        });
        res.write("retry: 1000\n\n");
        const unsubscribe = daemon.subscribe(() => {
          res.write("event: clear\ndata: {}\n\n");
        });
        req.on("close", unsubscribe);
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
  });
}

// Convenience entrypoint for running the daemon standalone (live wiring).
export function startDaemon(port: number = DEFAULT_DAEMON_PORT): {
  daemon: NoteDaemon;
  server: Server;
} {
  const daemon = new NoteDaemon();
  const server = createDaemonServer(daemon);
  server.listen(port, "127.0.0.1");
  return { daemon, server };
}
