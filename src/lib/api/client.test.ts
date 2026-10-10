import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiRequest, CSRF_HEADER, setUnauthorizedHandler } from "./client";
import { ApiError } from "./errors";

type Call = { url: string; init: RequestInit };

function mockFetch(response: Response | (() => Promise<Response>)) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return typeof response === "function" ? response() : response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const headersOf = (call: Call) => call.init.headers as Record<string, string>;

beforeEach(() => {
  vi.stubGlobal("document", { cookie: "other=1; tos_csrf=csrf%2Dvalue; x=y" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CSRF header", () => {
  it("is sent on POST from the tos_csrf cookie", async () => {
    const calls = mockFetch(json(200, { ok: true }));
    await api.post("/api/v1/x", { a: 1 });
    expect(calls[0].url).toBe("/api/v1/x");
    expect(headersOf(calls[0])[CSRF_HEADER]).toBe("csrf-value");
    expect(calls[0].init.credentials).toBe("include");
    expect(calls[0].init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("is not sent on GET", async () => {
    const calls = mockFetch(json(200, { ok: true }));
    await api.get("/api/v1/x");
    expect(headersOf(calls[0])[CSRF_HEADER]).toBeUndefined();
    expect(calls[0].init.credentials).toBe("include");
  });

  it("sends FormData as multipart without a JSON content type", async () => {
    const calls = mockFetch(json(201, { ok: true }));
    const form = new FormData();
    form.append("category", "other");
    await api.post("/api/v1/x", form);
    expect(calls[0].init.body).toBe(form);
    expect(headersOf(calls[0])["Content-Type"]).toBeUndefined();
    expect(headersOf(calls[0])[CSRF_HEADER]).toBe("csrf-value");
  });

  it("is omitted when there is no cookie", async () => {
    vi.stubGlobal("document", { cookie: "" });
    const calls = mockFetch(json(200, { ok: true }));
    await api.post("/api/v1/x");
    expect(headersOf(calls[0])[CSRF_HEADER]).toBeUndefined();
  });
});

describe("relative URLs only", () => {
  it("rejects absolute URLs", async () => {
    mockFetch(json(200, {}));
    await expect(apiRequest("http://127.0.0.1:8000/api/x")).rejects.toThrow(/relative/);
  });
});

describe("401 handling", () => {
  it("calls the unauthorized handler", async () => {
    const handler = vi.fn();
    const off = setUnauthorizedHandler(handler);
    mockFetch(json(401, { error: { code: "unauthorized", message: "Auth", details: {} } }));
    await expect(api.get("/api/v1/auth/me")).rejects.toMatchObject({ status: 401, code: "unauthorized" });
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("skips the handler with skipAuthHandler", async () => {
    const handler = vi.fn();
    const off = setUnauthorizedHandler(handler);
    mockFetch(json(401, { error: { code: "invalid_credentials", message: "Bad", details: {} } }));
    await expect(api.post("/api/v1/auth/login", {}, { skipAuthHandler: true })).rejects.toMatchObject({
      code: "invalid_credentials",
    });
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("does not call the handler for other errors", async () => {
    const handler = vi.fn();
    const off = setUnauthorizedHandler(handler);
    mockFetch(json(403, { error: { code: "csrf_failed", message: "CSRF", details: {} } }));
    await expect(api.post("/api/v1/x")).rejects.toMatchObject({ status: 403, code: "csrf_failed" });
    expect(handler).not.toHaveBeenCalled();
    off();
  });
});

describe("transport failures", () => {
  it("maps a network rejection to status 0", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const err = await api.get("/api/v1/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: "network_error" });
  });

  it("rethrows AbortError", async () => {
    mockFetch(() => Promise.reject(new DOMException("aborted", "AbortError")));
    const err = await api.get("/api/v1/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("AbortError");
  });

  it("maps a body read failure to status 0", async () => {
    const res = new Response("x", { status: 200 });
    vi.spyOn(res, "text").mockRejectedValue(new TypeError("stream broke"));
    mockFetch(res);
    await expect(api.get("/api/v1/x")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("rethrows AbortError raised while reading the body", async () => {
    const res = new Response("x", { status: 200 });
    vi.spyOn(res, "text").mockRejectedValue(new DOMException("aborted", "AbortError"));
    mockFetch(res);
    const err = await api.get("/api/v1/x").catch((e: unknown) => e);
    expect((err as DOMException).name).toBe("AbortError");
  });
});

describe("2xx bodies", () => {
  it("returns parsed JSON", async () => {
    mockFetch(json(200, { a: 1 }));
    await expect(api.get("/api/v1/x")).resolves.toEqual({ a: 1 });
  });

  it("returns undefined for 204", async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(api.post("/api/v1/auth/logout")).resolves.toBeUndefined();
  });

  it("returns undefined for an empty 202", async () => {
    mockFetch(new Response(null, { status: 202 }));
    await expect(api.post("/api/v1/x", {})).resolves.toBeUndefined();
  });

  it("returns null for an explicit JSON null 200 body", async () => {
    mockFetch(new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(api.get("/api/v1/clients/c1/billing-profile")).resolves.toBeNull();
  });

  it("throws invalid_response for an empty 200 body", async () => {
    mockFetch(new Response("", { status: 200 }));
    await expect(api.get("/api/v1/x")).rejects.toMatchObject({ status: 200, code: "invalid_response" });
  });

  it("throws invalid_response for a non-JSON 200 body", async () => {
    mockFetch(new Response("<html>", { status: 200 }));
    await expect(api.get("/api/v1/x")).rejects.toMatchObject({ status: 200, code: "invalid_response" });
  });
});
