import { api } from "@/lib/api/client";
import type {
  BoardFieldOut,
  BoardPostingOut,
  BoardReportRow,
  BoardSetOut,
  FeedSettings,
  JobBoardSettings,
  MappingOut,
  MultiPostIn,
  MultiPostPreviewOut,
  PackOut,
  PublishOut,
  RecordIn,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export type RowAction = "refresh" | "close" | "retry" | "abandon" | "mark-closed";

export const jobBoardsApi = {
  list: (demandId: string) => api.get<BoardPostingOut[]>(`${V}/demands/${enc(demandId)}/board-postings`),
  preview: (demandId: string, body: MultiPostIn) =>
    api.post<MultiPostPreviewOut>(`${V}/demands/${enc(demandId)}/board-postings/preview`, body),
  publish: (demandId: string, body: MultiPostIn & { acknowledge_bias_flags: boolean }, idempotencyKey: string) =>
    api.post<PublishOut>(`${V}/demands/${enc(demandId)}/board-postings`, body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  updateBoards: (ids: string[]) => api.post<BoardPostingOut[]>(`${V}/board-postings/update`, { ids }),
  action: (id: string, action: RowAction) => api.post<BoardPostingOut>(`${V}/board-postings/${enc(id)}/${action}`),
  pack: (id: string) => api.get<PackOut>(`${V}/board-postings/${enc(id)}/pack`),
  record: (id: string, body: RecordIn) => api.post<BoardPostingOut>(`${V}/board-postings/${enc(id)}/record`, body),
  settings: () => api.get<JobBoardSettings>(`${V}/job-boards/settings`),
  saveSettings: (body: Partial<JobBoardSettings>) => api.put<JobBoardSettings>(`${V}/job-boards/settings`, body),
  boardSets: () => api.get<BoardSetOut[]>(`${V}/job-boards/board-sets`),
  createBoardSet: (body: Omit<BoardSetOut, "id">) => api.post<BoardSetOut>(`${V}/job-boards/board-sets`, body),
  updateBoardSet: (id: string, body: Partial<Omit<BoardSetOut, "id">>) =>
    api.patch<BoardSetOut>(`${V}/job-boards/board-sets/${enc(id)}`, body),
  fields: (boardKey: string) => api.get<BoardFieldOut[]>(`${V}/job-boards/${enc(boardKey)}/fields`),
  mappings: (boardKey: string) => api.get<MappingOut[]>(`${V}/job-boards/${enc(boardKey)}/mappings`),
  saveMappings: (boardKey: string, items: MappingOut[]) =>
    api.put<MappingOut[]>(`${V}/job-boards/${enc(boardKey)}/mappings`, {
      items: items.map(({ kind, local_value, board_value, board_label }) => ({
        kind,
        local_value,
        board_value,
        board_label: board_label ?? null,
      })),
    }),
  feed: () => api.get<FeedSettings>(`${V}/job-boards/feed`),
  saveFeed: (body: Partial<Omit<FeedSettings, "feed_url">>) => api.put<FeedSettings>(`${V}/job-boards/feed`, body),
  regenerateFeed: () => api.post<FeedSettings>(`${V}/job-boards/feed/regenerate`),
  report: (q: { from?: string; to?: string; board_key?: string }) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
    const qs = p.toString();
    return api.get<BoardReportRow[]>(`${V}/job-boards/report${qs ? `?${qs}` : ""}`);
  },
};
