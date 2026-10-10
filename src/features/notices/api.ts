import { api } from "@/lib/api/client";
import type { PlatformNoticeOut, SubProcessorOut } from "@/lib/api/types";

export const noticesApi = {
  list: (signal?: AbortSignal) => api.get<PlatformNoticeOut[]>("/api/v1/notices", { signal }),
  ack: (id: string) => api.post<void>(`/api/v1/notices/${encodeURIComponent(id)}/ack`),
  subProcessors: (signal?: AbortSignal) => api.get<SubProcessorOut[]>("/api/v1/sub-processors", { signal }),
};

export const noticeKeys = {
  list: ["notices"] as const,
  subProcessors: ["sub-processors"] as const,
};
