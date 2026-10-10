import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { privacyErrorMessage } from "../api";
import type {
  ClassExpiryPreview,
  RetentionBinding,
  RetentionClass,
  RetentionClassCreate,
  RetentionClassUpdate,
} from "./types";

const R = "/api/v1/privacy/retention";
const enc = encodeURIComponent;

export const retentionClassesApi = {
  classes: (signal?: AbortSignal) => api.get<RetentionClass[]>(`${R}/classes`, { signal }),
  create: (body: RetentionClassCreate) => api.post<RetentionClass>(`${R}/classes`, body),
  update: (id: string, body: RetentionClassUpdate) => api.patch<RetentionClass>(`${R}/classes/${enc(id)}`, body),
  archive: (id: string) => api.post<RetentionClass>(`${R}/classes/${enc(id)}/archive`),
  bindings: (signal?: AbortSignal) => api.get<RetentionBinding[]>(`${R}/bindings`, { signal }),
  preview: (classKey: string) => api.post<ClassExpiryPreview>(`${R}/expiry/preview?class_key=${enc(classKey)}`),
  execute: (runId: string, confirm: string) => api.post<unknown>(`${R}/runs/${enc(runId)}/execute`, { confirm }),
};

export const retentionClassKeys = {
  classes: ["privacy", "retention", "classes"] as const,
  bindings: ["privacy", "retention", "bindings"] as const,
};

/** User-facing message for a retention-class failure (floor, system class), else the privacy defaults. */
export function retentionClassErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === "below_statutory_floor") {
      const floor = e.details.floor_months;
      return typeof floor === "number"
        ? `The period cannot be shorter than the statutory minimum of ${floor} months.`
        : "The period is shorter than the statutory minimum for this class.";
    }
    if (e.code === "system_class") return "System classes cannot be archived. You can still change their period.";
    if (e.code === "class_key_taken" || e.status === 409) return e.message || "A class with this key already exists.";
  }
  return privacyErrorMessage(e);
}
