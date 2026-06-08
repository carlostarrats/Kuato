import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { NoteDaemon } from "./NoteDaemon";
import { createDaemonServer } from "./server";
import type { NotePayload } from "../note";

const note: NotePayload = {
  selector: "section.panel",
  tag: "section",
  text: "Account settings",
  attrs: { "data-testid": "panel" },
};

let server: Server | null = null;

function start(daemon: NoteDaemon): Promise<string> {
  server = createDaemonServer(daemon);
  return new Promise((resolve) => {
    server!.listen(0, "127.0.0.1", () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((r) => server!.close(() => r()));
    server = null;
  }
});

describe("daemon HTTP endpoints (the surfaces the hooks + overlay call)", () => {
  it("POST /note buffers it; GET /note (the send hook) returns it + injectable context", async () => {
    const daemon = new NoteDaemon();
    const base = await start(daemon);

    const post = await fetch(`${base}/note`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(note),
    });
    expect(post.status).toBe(200);

    const got = await (await fetch(`${base}/note`)).json();
    expect(got.note).toMatchObject(note);
    expect(got.context).toContain("Account settings");
    expect(got.context).toContain("section.panel");
    expect(got.context).toContain("data-testid");
  });

  it("answers the CORS preflight so a cross-origin overlay (app port → daemon port) can POST", async () => {
    const daemon = new NoteDaemon();
    const base = await start(daemon);

    const res = await fetch(`${base}/note`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(
      (res.headers.get("access-control-allow-headers") ?? "").toLowerCase()
    ).toContain("content-type");
  });

  it("POST /complete (the signal hook) clears the buffered pin", async () => {
    const daemon = new NoteDaemon();
    const base = await start(daemon);
    daemon.setNote(note);

    const res = await fetch(`${base}/complete`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(daemon.getActiveNote()).toBeNull();
  });

  it("POST /cancel (overlay Cancel) clears the buffered pin", async () => {
    const daemon = new NoteDaemon();
    const base = await start(daemon);
    daemon.setNote(note);

    const res = await fetch(`${base}/cancel`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(daemon.getActiveNote()).toBeNull();
  });

  it("GET /note with nothing buffered reports no active pin", async () => {
    const daemon = new NoteDaemon();
    const base = await start(daemon);

    const got = await (await fetch(`${base}/note`)).json();
    expect(got.note).toBeNull();
    expect(got.context).toBeNull();
  });
});
