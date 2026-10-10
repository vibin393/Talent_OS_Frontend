import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { csrfEndpointFor, isCsrfExhausted, withCsrfRetry } from "@/lib/api/csrf-retry";
import { ApiError } from "@/lib/api/errors";
import { accessDeniedFrom, accessDeniedMessage, askLabel } from "./access";
import { AccessDenied } from "./access-denied";
import { saveFormDraft, takeFormDraft } from "./use-form-draft";

const csrf403 = () => new ApiError(403, "csrf_failed", "CSRF token missing or invalid");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FR-82 access denied", () => {
  it("reads the envelope details and the principal's contact", () => {
    const user = new ApiError(403, "forbidden", "no", { action: "Manage contracts", required_permission: "contract:write", ask: "tenant_admin" });
    expect(accessDeniedFrom(user)).toEqual({ action: "Manage contracts", requiredPermission: "contract:write", ask: "tenant_admin" });
    const portal = new ApiError(403, "portal_permission_required", "no", { action: "time:approve", ask: "account_manager" });
    expect(accessDeniedFrom(portal)?.ask).toBe("account_manager");
    expect(accessDeniedFrom(csrf403())).toBeNull();
    expect(accessDeniedFrom(new ApiError(404, "not_found", "x"))).toBeNull();
    expect(askLabel("tenant_admin")).toBe("Ask your Tenant Admin");
    expect(askLabel("account_manager")).toBe("Ask your Account Manager");
    expect(accessDeniedMessage({ action: "Issue invoices", requiredPermission: null, ask: "tenant_admin" })).toBe(
      "You don't have access to: Issue invoices. Ask your Tenant Admin.",
    );
  });

  it("renders the copy per principal", () => {
    const internal = renderToStaticMarkup(createElement(AccessDenied, { action: "Manage contracts", ask: "tenant_admin" }));
    expect(internal).toContain("You don&#x27;t have access");
    expect(internal).toContain("Manage contracts");
    expect(internal).toContain("Ask your Tenant Admin");
    const portal = renderToStaticMarkup(createElement(AccessDenied, { ask: "account_manager" }));
    expect(portal).toContain("Ask your Account Manager");
  });
});

describe("CSRF retry", () => {
  it("refreshes the token and retries once", async () => {
    const run = vi.fn().mockRejectedValueOnce(csrf403()).mockResolvedValueOnce("ok");
    const refresh = vi.fn().mockResolvedValue(undefined);
    await expect(withCsrfRetry(run, refresh)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("gives up after the second failure with retried=true", async () => {
    const run = vi.fn().mockRejectedValue(csrf403());
    const error = await withCsrfRetry(run, async () => undefined).catch((e: unknown) => e);
    expect(isCsrfExhausted(error)).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not retry other errors", async () => {
    const run = vi.fn().mockRejectedValue(new ApiError(403, "forbidden", "no"));
    const refresh = vi.fn();
    await expect(withCsrfRetry(run, refresh)).rejects.toMatchObject({ code: "forbidden" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("picks the surface's /csrf endpoint", () => {
    expect(csrfEndpointFor("/api/v1/client-portal/x")).toBe("/api/v1/client-portal/csrf");
    expect(csrfEndpointFor("/api/v1/vendor-portal/users")).toBe("/api/v1/vendor-portal/csrf");
    expect(csrfEndpointFor("/api/v1/portal/profile")).toBe("/api/v1/portal/csrf");
    expect(csrfEndpointFor("/api/v1/candidates")).toBe("/api/v1/auth/csrf");
  });

  it("apiRequest re-issues the cookie through /csrf and retries the POST", async () => {
    vi.stubGlobal("document", { cookie: "tos_csrf=old" });
    const urls: string[] = [];
    let posts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        urls.push(`${init.method} ${url}`);
        if (url.endsWith("/csrf")) return new Response(null, { status: 204 });
        posts += 1;
        if (posts === 1) {
          return new Response(JSON.stringify({ error: { code: "csrf_failed", message: "x", details: {} } }), { status: 403 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    await expect(apiRequest("/api/v1/client-portal/things", { method: "POST", body: {} })).resolves.toEqual({ ok: true });
    expect(urls).toEqual([
      "POST /api/v1/client-portal/things",
      "GET /api/v1/client-portal/csrf",
      "POST /api/v1/client-portal/things",
    ]);
  });
});

describe("form drafts", () => {
  it("survive a reload once and tolerate missing storage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    saveFormDraft("le-profile", { name: "Acme" });
    expect(takeFormDraft("le-profile")).toEqual({ name: "Acme" });
    expect(takeFormDraft("le-profile")).toBeNull();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
        removeItem: () => undefined,
      },
    });
    expect(() => saveFormDraft("x", 1)).not.toThrow();
    expect(takeFormDraft("x")).toBeNull();
  });
});
