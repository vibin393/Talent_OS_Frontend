import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { parseMaskedHeader, requestExport } from "./api";
import { canDownload, exportsPollInterval, isExpired, POLL_MS } from "./exports-page";
import { canExport, outcomeNotices, tooLargeMessage } from "./use-export";

function response(status: number, body: BodyInit | null, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

const BODY = { kind: "submissions", format: "xlsx", filters: { sent_by: "me" } } as const;

describe("export request", () => {
  it("downloads a sync export with the server's filename and reports masked columns", async () => {
    const save = vi.fn();
    const fetch = vi.fn().mockResolvedValue(
      response(200, "a,b\n1,2\n", {
        "Content-Disposition": 'attachment; filename="submissions-2026-09-30.xlsx"',
        "X-TOS-Masked-Columns": "pay_rate,bill_rate,margin_amount",
        "X-Export-Rows": "3200",
      }),
    );
    const outcome = await requestExport({ ...BODY, filters: { ...BODY.filters } }, { fetch, save });
    expect(outcome).toEqual({
      type: "downloaded",
      filename: "submissions-2026-09-30.xlsx",
      maskedColumns: ["pay_rate", "bill_rate", "margin_amount"],
      rowCount: 3200,
    });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][1]).toBe("submissions-2026-09-30.xlsx");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/v1/exports");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ kind: "submissions", format: "xlsx", filters: { sent_by: "me" } });
    expect(outcomeNotices(outcome).map((n) => n.kind)).toEqual(["success", "info"]);
    expect(outcomeNotices(outcome)[1].text).toBe("Compensation columns were excluded.");
  });

  it("returns a queued outcome for 202 and toasts with a link", async () => {
    const fetch = vi.fn().mockResolvedValue(
      response(202, JSON.stringify({ export_id: "e1", status: "queued", row_count: 12000, masked_columns: [] }), {
        "Content-Type": "application/json",
      }),
    );
    const outcome = await requestExport({ ...BODY, filters: {} }, { fetch, save: vi.fn() });
    expect(outcome).toEqual({ type: "queued", exportId: "e1", maskedColumns: [], rowCount: 12000 });
    const notices = outcomeNotices(outcome);
    expect(notices).toEqual([{ kind: "queued", text: "Preparing your export… we'll notify you when it's ready." }]);
  });

  it("turns 422 export_too_large into a dialog outcome", async () => {
    const fetch = vi.fn().mockResolvedValue(
      response(
        422,
        JSON.stringify({ error: { code: "export_too_large", message: "Too large", details: { row_count: 73412, max: 50000 } } }),
      ),
    );
    const outcome = await requestExport({ ...BODY, filters: {} }, { fetch, save: vi.fn() });
    expect(outcome).toEqual({ type: "too_large", rowCount: 73412, max: 50000 });
    expect(outcomeNotices(outcome)).toEqual([]);
    expect(tooLargeMessage(73412, 50000)).toBe(
      `This view has ${(73412).toLocaleString()} rows; exports are limited to ${(50000).toLocaleString()}. Narrow your filters.`,
    );
  });

  it("reports 429 as a toast and throws other errors", async () => {
    const limited = await requestExport(
      { ...BODY, filters: {} },
      { fetch: vi.fn().mockResolvedValue(response(429, JSON.stringify({ error: { code: "rate_limited", message: "Slow down" } }))) },
    );
    expect(limited.type).toBe("rate_limited");
    expect(outcomeNotices(limited)[0].kind).toBe("error");
    await expect(
      requestExport(
        { ...BODY, filters: {} },
        { fetch: vi.fn().mockResolvedValue(response(403, JSON.stringify({ error: { code: "forbidden", message: "No" } }))) },
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("parses the masked-columns header", () => {
    expect(parseMaskedHeader(null)).toEqual([]);
    expect(parseMaskedHeader(" bill_rate , ,pay_rate")).toEqual(["bill_rate", "pay_rate"]);
  });

  it("requires report:export and the kind's read permission", () => {
    expect(canExport({ "report:export": "tenant", "submission:read": "bu" }, "submissions")).toBe(true);
    expect(canExport({ "report:export": "tenant" }, "submissions")).toBe(false);
    expect(canExport({ "candidate:read": "tenant" }, "candidates")).toBe(false);
  });
});

describe("my exports page", () => {
  const now = new Date("2026-09-30T12:00:00Z").getTime();

  it("polls only while exports are queued or running", () => {
    expect(exportsPollInterval([{ status: "done" }, { status: "running" }])).toBe(POLL_MS);
    expect(exportsPollInterval([{ status: "done" }, { status: "failed" }])).toBe(false);
    expect(exportsPollInterval(undefined)).toBe(false);
  });

  it("offers download only for unexpired async exports", () => {
    const e = { status: "done" as const, mode: "async" as const, expires_at: "2026-10-01T00:00:00Z" };
    expect(canDownload(e, now)).toBe(true);
    expect(canDownload({ ...e, mode: "sync" }, now)).toBe(false);
    expect(canDownload({ ...e, expires_at: "2026-09-30T11:00:00Z" }, now)).toBe(false);
    expect(isExpired({ status: "expired", expires_at: null }, now)).toBe(true);
  });
});
