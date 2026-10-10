#!/usr/bin/env node
/**
 * Epic 54 SSE smoke (B8): the Copilot turn stream must not be buffered by the Next.js proxy. The first `text.delta`
 * has to reach the browser side at least 300 ms before `turn.completed`.
 *
 *   node scripts/smoke-copilot-sse.mjs --mock-backend 8765            # start a mock SSE backend only
 *   node scripts/smoke-copilot-sse.mjs --url http://127.0.0.1:3000 \
 *        --path /api/v1/copilot/turns/<run>/events [--cookie "tos_session=..."]
 *
 * With `--mock-backend`, run Next with BACKEND_URL=http://127.0.0.1:<port>; any `/api/v1/copilot/turns/<id>/events`
 * path then streams: turn.started, a delta, (1.5 s) another delta, (1 s) turn.completed.
 */
import http from "node:http";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => (cur.startsWith("--") ? [...acc, [cur.slice(2), all[i + 1]]] : acc), []),
);

function mockBackend(port) {
  const server = http.createServer((req, res) => {
    if (!/^\/api\/v1\/copilot\/turns\/[^/]+\/events/.test(req.url ?? "")) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    });
    const send = (id, event, data) => res.write(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("1-0", "turn.started", { run_id: "r" });
    send("2-0", "text.delta", { text: "Two demands " });
    setTimeout(() => send("3-0", "text.delta", { text: "are at risk." }), 1500);
    setTimeout(() => {
      send("4-0", "turn.completed", { run_id: "r", status: "completed", reason_code: null, message_seq: 2 });
      res.end();
    }, 2500);
  });
  server.listen(Number(port), "127.0.0.1", () => console.log(`mock SSE backend on :${port}`));
}

async function smoke(url, path, cookie) {
  const started = Date.now();
  const res = await fetch(new URL(path, url), { headers: { Accept: "text/event-stream", ...(cookie ? { Cookie: cookie } : {}) } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("text/event-stream")) throw new Error(`unexpected content-type ${type}`);
  const decoder = new TextDecoder();
  let buffer = "";
  let firstDelta = null;
  let completed = null;
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    if (firstDelta === null && buffer.includes("event: text.delta")) firstDelta = Date.now() - started;
    if (buffer.includes("event: turn.completed") || buffer.includes("event: turn.failed")) {
      completed = Date.now() - started;
      break;
    }
  }
  console.log(JSON.stringify({ firstDeltaMs: firstDelta, completedMs: completed }));
  if (firstDelta === null || completed === null) throw new Error("stream ended without a delta / completion");
  if (completed - firstDelta < 300) throw new Error("the stream is buffered: the first delta arrived with the completion");
  console.log("SSE smoke passed: deltas stream through the proxy");
}

if (args["mock-backend"]) {
  mockBackend(args["mock-backend"]);
} else {
  smoke(args.url ?? "http://127.0.0.1:3000", args.path ?? "/api/v1/copilot/turns/smoke/events", args.cookie).catch((e) => {
    console.error(`SSE smoke failed: ${e.message}`);
    process.exit(1);
  });
}
