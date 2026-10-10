/**
 * Export engine client (Epic 11, B3). `POST /exports` answers either with the file itself (small
 * exports, 200) or `202 {export_id}` (queued; the user is notified when it is ready).
 */
import { api, CSRF_COOKIE, CSRF_HEADER, readCookie } from "@/lib/api/client";
import { filenameFromDisposition } from "@/lib/api/download";
import { ApiError, toApiError } from "@/lib/api/errors";
import type { ExportAccepted, ExportCreate, ExportOut } from "@/lib/api/types";
import { pageParams } from "@/features/admin/query";

export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export type ExportOutcome =
  | { type: "downloaded"; filename: string; maskedColumns: string[]; rowCount: number | null }
  | { type: "queued"; exportId: string; maskedColumns: string[]; rowCount: number }
  | { type: "too_large"; rowCount: number | null; max: number | null }
  | { type: "rate_limited"; message: string };

/** `X-TOS-Masked-Columns: bill_rate,pay_rate` -> list. */
export function parseMaskedHeader(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function fallbackFilename(kind: string, format: string, today = new Date()): string {
  return `${kind}-${today.toISOString().slice(0, 10)}.${format}`;
}

/** Save a blob through a temporary object URL. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Request an export. A sync 200 is saved immediately (`save`); 202, 422 `export_too_large` and 429 are
 * returned as outcomes; any other failure throws `ApiError`.
 */
export async function requestExport(
  body: ExportCreate,
  deps: { fetch?: typeof fetch; save?: (blob: Blob, filename: string) => void } = {},
): Promise<ExportOutcome> {
  const doFetch = deps.fetch ?? fetch;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "*/*" };
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf) headers[CSRF_HEADER] = csrf;
  let res: Response;
  try {
    res = await doFetch("/api/v1/exports", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }

  if (res.status === 202) {
    const accepted = (await res.json().catch(() => null)) as ExportAccepted | null;
    return {
      type: "queued",
      exportId: accepted?.export_id ?? res.headers.get("X-Export-Id") ?? "",
      maskedColumns: accepted?.masked_columns ?? parseMaskedHeader(res.headers.get("X-TOS-Masked-Columns")),
      rowCount: accepted?.row_count ?? num(res.headers.get("X-Export-Rows")) ?? 0,
    };
  }
  if (res.ok) {
    const blob = await res.blob();
    const filename = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? fallbackFilename(body.kind, body.format);
    (deps.save ?? saveBlob)(blob, filename);
    return {
      type: "downloaded",
      filename,
      maskedColumns: parseMaskedHeader(res.headers.get("X-TOS-Masked-Columns")),
      rowCount: num(res.headers.get("X-Export-Rows")),
    };
  }

  const payload = await res.json().catch(() => null);
  const error = toApiError(res.status, payload);
  if (res.status === 422 && error.code === "export_too_large") {
    return { type: "too_large", rowCount: num(error.details.row_count), max: num(error.details.max) };
  }
  if (res.status === 429) return { type: "rate_limited", message: error.message };
  throw error;
}

export const exportsApi = {
  list: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<ExportOut>>(`/api/v1/exports?${pageParams(page, pageSize)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<ExportOut>(`/api/v1/exports/${encodeURIComponent(id)}`, { signal }),
  downloadPath: (id: string) => `/api/v1/exports/${encodeURIComponent(id)}/download`,
};

export const exportKeys = {
  all: ["exports"] as const,
  list: (page: number) => ["exports", "list", page] as const,
};
