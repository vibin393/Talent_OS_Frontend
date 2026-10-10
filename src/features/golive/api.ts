import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { dependencyMissingMessage } from "./p3/kind-order";
import type { GoLiveApplyIn, GoLiveImport, GoLiveKindOut, GoLiveRow } from "./types";

const G = "/api/v1/golive";
const enc = encodeURIComponent;

export const goLiveUrls = {
  template: (kind: string) => `${G}/templates/${enc(kind)}`,
  errorReport: (importId: string) => `${G}/imports/${enc(importId)}/errors.csv`,
};

export const goLiveApi = {
  kinds: (signal?: AbortSignal) => api.get<GoLiveKindOut[]>(`${G}/kinds`, { signal }),
  upload: (kind: string, file: File) => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    return api.post<GoLiveImport>(`${G}/imports`, form);
  },
  import: (id: string, signal?: AbortSignal) => api.get<GoLiveImport>(`${G}/imports/${enc(id)}`, { signal }),
  rows: (id: string, status: string | null, signal?: AbortSignal) =>
    api.get<GoLiveRow[]>(`${G}/imports/${enc(id)}/rows${status ? `?status=${enc(status)}` : ""}`, { signal }),
  apply: (id: string, body: GoLiveApplyIn, idempotencyKey: string) =>
    api.post<GoLiveImport>(`${G}/imports/${enc(id)}/apply`, body, { headers: { "Idempotency-Key": idempotencyKey } }),
};

export const goLiveKeys = {
  kinds: ["golive", "kinds"] as const,
  import: (id: string) => ["golive", "imports", id] as const,
  rows: (id: string, status: string | null) => ["golive", "imports", id, "rows", status] as const,
};

const MESSAGES: Record<string, string> = {
  has_errors: "Some rows have errors. Fix the file, or choose to skip invalid rows.",
  forbidden: "You need the go-live import permission to do this.",
  unsupported_file: "Upload a CSV file.",
};

export function goLiveErrorMessage(e: unknown, kinds: readonly Pick<GoLiveKindOut, "kind" | "label">[] = []): string {
  if (isApiError(e) && e.code === "dependency_missing") return dependencyMissingMessage(e.details, kinds);
  if (isApiError(e) && MESSAGES[e.code]) return MESSAGES[e.code];
  return errorMessage(e);
}
