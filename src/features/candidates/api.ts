import { api } from "@/lib/api/client";
import type {
  AIActionOut,
  AttachmentCategory,
  AttachmentOut,
  BulkTagsOut,
  Candidate360Out,
  CandidateCreate,
  CandidateCreatedOut,
  CandidateListCreate,
  CandidateListOut,
  CandidateListUpdate,
  CandidateOut,
  CandidateSkillIn,
  CandidateSkillOut,
  CandidateUpdate,
  DuplicateDetailOut,
  DuplicateOut,
  ImportBatchDetailOut,
  ImportBatchOut,
  ImportItemStatus,
  ListSharesIn,
  MergeIn,
  MergeOut,
  Page,
  ResumeApply,
  ResumeApplyOut,
  ResumeDraftOut,
  ResumeOut,
  ResumeUploadOut,
  SkillOut,
  TagOut,
} from "@/lib/api/types";
import { pageParams } from "@/features/admin/query";
import { type CandidateListFilters, candidateListQuery } from "./query";

const enc = encodeURIComponent;
const C = "/api/v1/candidates";

function fileForm(file: File, extra: Record<string, string | null | undefined> = {}): FormData {
  const form = new FormData();
  form.append("file", file, file.name);
  for (const [k, v] of Object.entries(extra)) if (v) form.append(k, v);
  return form;
}

export const candidatesApi = {
  list: (filters: CandidateListFilters, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<CandidateOut>>(`${C}?${candidateListQuery(filters, page, pageSize)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<Candidate360Out>(`${C}/${enc(id)}`, { signal }),
  create: (body: CandidateCreate) => api.post<CandidateCreatedOut>(C, body),
  update: (id: string, body: CandidateUpdate) => api.patch<Candidate360Out>(`${C}/${enc(id)}`, body),
  setSkills: (id: string, skills: CandidateSkillIn[]) =>
    api.put<CandidateSkillOut[]>(`${C}/${enc(id)}/skills`, { skills }),
  archive: (id: string) => api.post<Candidate360Out>(`${C}/${enc(id)}/archive`),
  unarchive: (id: string) => api.post<Candidate360Out>(`${C}/${enc(id)}/unarchive`),

  resumeDraft: (file: File) => api.post<ResumeDraftOut>(`${C}/resume-drafts`, fileForm(file)),
  listResumes: (id: string, signal?: AbortSignal) => api.get<ResumeOut[]>(`${C}/${enc(id)}/resumes`, { signal }),
  uploadResume: (id: string, file: File) => api.post<ResumeUploadOut>(`${C}/${enc(id)}/resumes`, fileForm(file)),
  applyResume: (id: string, resumeId: string, body: ResumeApply) =>
    api.post<ResumeApplyOut>(`${C}/${enc(id)}/resumes/${enc(resumeId)}/apply`, body),
  aiActions: (id: string, signal?: AbortSignal) => api.get<AIActionOut[]>(`${C}/${enc(id)}/ai-actions`, { signal }),

  addTags: (id: string, names: string[]) => api.post<TagOut[]>(`${C}/${enc(id)}/tags`, { names }),
  removeTag: (id: string, tagId: string) => api.delete<TagOut[]>(`${C}/${enc(id)}/tags/${enc(tagId)}`),
  bulkTags: (candidateIds: string[], names: string[]) =>
    api.post<BulkTagsOut>(`${C}/bulk/tags`, { candidate_ids: candidateIds, names }),
  searchTags: (q: string, signal?: AbortSignal) => {
    const params = pageParams(1, 20);
    if (q.trim()) params.set("q", q.trim().slice(0, 100));
    return api.get<Page<TagOut>>(`/api/v1/tags?${params}`, { signal });
  },
  searchSkills: (q: string, signal?: AbortSignal) => {
    const params = pageParams(1, 20);
    if (q.trim()) params.set("q", q.trim().slice(0, 200));
    params.set("include_pending", "true");
    return api.get<Page<SkillOut>>(`/api/v1/skills?${params}`, { signal });
  },

  listDuplicates: (status: DuplicateOut["status"] | null, page: number, pageSize: number, signal?: AbortSignal) => {
    const params = pageParams(page, pageSize);
    if (status) params.set("status", status);
    return api.get<Page<DuplicateOut>>(`${C}/duplicates?${params}`, { signal });
  },
  getDuplicate: (id: string, signal?: AbortSignal) =>
    api.get<DuplicateDetailOut>(`${C}/duplicates/${enc(id)}`, { signal }),
  merge: (duplicateId: string, body: MergeIn) => api.post<MergeOut>(`${C}/duplicates/${enc(duplicateId)}/merge`, body),
  keepSeparate: (duplicateId: string) => api.post<DuplicateOut>(`${C}/duplicates/${enc(duplicateId)}/keep-separate`),
  listMerges: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<MergeOut>>(`${C}/merges?${pageParams(page, pageSize)}`, { signal }),
  undoMerge: (mergeId: string) => api.post<MergeOut>(`${C}/merges/${enc(mergeId)}/undo`),

  createImport: (files: File[]) => {
    const form = new FormData();
    for (const f of files) form.append("files", f, f.name);
    return api.post<ImportBatchOut>(`${C}/imports`, form);
  },
  listImports: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<ImportBatchOut>>(`${C}/imports?${pageParams(page, pageSize)}`, { signal }),
  getImport: (id: string, status: ImportItemStatus | null, page: number, pageSize: number, signal?: AbortSignal) => {
    const params = pageParams(page, pageSize);
    if (status) params.set("status", status);
    return api.get<ImportBatchDetailOut>(`${C}/imports/${enc(id)}?${params}`, { signal });
  },

  listLists: (page: number, pageSize: number, includeArchived = false, signal?: AbortSignal) => {
    const params = pageParams(page, pageSize);
    if (includeArchived) params.set("include_archived", "true");
    return api.get<Page<CandidateListOut>>(`/api/v1/candidate-lists?${params}`, { signal });
  },
  getList: (id: string, signal?: AbortSignal) => api.get<CandidateListOut>(`/api/v1/candidate-lists/${enc(id)}`, { signal }),
  createList: (body: CandidateListCreate) => api.post<CandidateListOut>("/api/v1/candidate-lists", body),
  updateList: (id: string, body: CandidateListUpdate) =>
    api.patch<CandidateListOut>(`/api/v1/candidate-lists/${enc(id)}`, body),
  deleteList: (id: string) => api.delete<CandidateListOut>(`/api/v1/candidate-lists/${enc(id)}`),
  shareList: (id: string, body: ListSharesIn) =>
    api.put<CandidateListOut>(`/api/v1/candidate-lists/${enc(id)}/shares`, body),
  addListMembers: (id: string, candidateIds: string[]) =>
    api.post<CandidateListOut>(`/api/v1/candidate-lists/${enc(id)}/members`, { candidate_ids: candidateIds }),
  removeListMember: (id: string, candidateId: string) =>
    api.delete<CandidateListOut>(`/api/v1/candidate-lists/${enc(id)}/members/${enc(candidateId)}`),

  listAttachments: (id: string, signal?: AbortSignal) =>
    api.get<AttachmentOut[]>(`${C}/${enc(id)}/attachments`, { signal }),
  addAttachment: (
    id: string,
    file: File,
    category: AttachmentCategory,
    expiresOn: string | null,
    note: string | null,
  ) =>
    api.post<AttachmentOut>(
      `${C}/${enc(id)}/attachments`,
      fileForm(file, { category, expires_on: expiresOn, note }),
    ),
  archiveAttachment: (attachmentId: string) => api.delete<AttachmentOut>(`/api/v1/attachments/${enc(attachmentId)}`),
};

/** Same-origin download URL of a stored file (served with `Content-Disposition: attachment`). */
export function fileDownloadUrl(fileId: string): string {
  return `/api/v1/files/${enc(fileId)}/download`;
}

export const candidateKeys = {
  all: ["candidates"] as const,
  lists: ["candidates", "list"] as const,
  list: (filters: CandidateListFilters, page: number, pageSize: number) =>
    ["candidates", "list", filters, page, pageSize] as const,
  detail: (id: string) => ["candidates", "detail", id] as const,
  resumes: (id: string) => ["candidates", "detail", id, "resumes"] as const,
  aiActions: (id: string) => ["candidates", "detail", id, "ai-actions"] as const,
  attachments: (id: string) => ["candidates", "detail", id, "attachments"] as const,
  tags: (q: string) => ["tags", q] as const,
  skills: (q: string) => ["skills", "search", q] as const,
  duplicates: ["candidates", "duplicates"] as const,
  duplicateList: (status: string | null, page: number) => ["candidates", "duplicates", "list", status, page] as const,
  duplicate: (id: string) => ["candidates", "duplicates", "detail", id] as const,
  merges: ["candidates", "merges"] as const,
  mergeList: (page: number) => ["candidates", "merges", page] as const,
  imports: ["candidates", "imports"] as const,
  importList: (page: number) => ["candidates", "imports", "list", page] as const,
  import: (id: string, status: string | null, page: number) => ["candidates", "imports", "detail", id, status, page] as const,
  savedLists: ["candidate-lists"] as const,
  savedListPage: (page: number, pageSize: number) => ["candidate-lists", "page", page, pageSize] as const,
  savedList: (id: string) => ["candidate-lists", "detail", id] as const,
};
