"use client";

/** Epic 22 internal-app calls (`/api/v1/documents/*`) and their TanStack Query hooks. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, CSRF_COOKIE, CSRF_HEADER, readCookie } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import type {
  DocumentOut,
  DocumentPatchIn,
  DocumentUploadIn,
  EsignConfigOption,
  LegalEntityOption,
  MergeCatalogue,
  MySignature,
  SignatureRequestIn,
  SignatureRequestOut,
  TemplateCreateIn,
  TemplateOut,
  TemplatePatchIn,
  TemplateVersionOut,
  VerifyOut,
} from "./types";

const D = "/api/v1/documents";
const enc = encodeURIComponent;

function qs(params: Record<string, string | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** POST that returns binary (PDF preview); same cookie + CSRF rules as `apiRequest`. */
export async function postForBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const headers: Record<string, string> = { Accept: "application/pdf, application/json" };
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf) headers[CSRF_HEADER] = csrf;
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers, credentials: "include", cache: "no-store", signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw toApiError(res.status, body);
  }
  return res.blob();
}

function fileForm(file: File, extra: Record<string, string | null | undefined> = {}): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== "") form.append(k, v);
  form.append("file", file);
  return form;
}

export const documentsApi = {
  // templates
  mergeFields: (signal?: AbortSignal) => apiRequest<MergeCatalogue>(`${D}/merge-fields`, { signal }),
  templates: (kind: string | null, includeArchived: boolean, signal?: AbortSignal) =>
    apiRequest<TemplateOut[]>(`${D}/templates${qs({ kind, include_archived: includeArchived || undefined })}`, { signal }),
  template: (id: string, signal?: AbortSignal) => apiRequest<TemplateOut>(`${D}/templates/${enc(id)}`, { signal }),
  createTemplate: (body: TemplateCreateIn) => apiRequest<TemplateOut>(`${D}/templates`, { method: "POST", body }),
  patchTemplate: (id: string, body: TemplatePatchIn) => apiRequest<TemplateOut>(`${D}/templates/${enc(id)}`, { method: "PATCH", body }),
  createVersion: (id: string, body_md: string) =>
    apiRequest<TemplateVersionOut>(`${D}/templates/${enc(id)}/versions`, { method: "POST", body: { body_md } }),
  publishVersion: (versionId: string) => apiRequest<TemplateOut>(`${D}/templates/versions/${enc(versionId)}/publish`, { method: "POST" }),
  previewVersion: (versionId: string, signal?: AbortSignal) => postForBlob(`${D}/templates/versions/${enc(versionId)}/preview`, signal),

  // documents
  list: (ownerKind: string, ownerId: string, includeArchived: boolean, signal?: AbortSignal) =>
    apiRequest<DocumentOut[]>(`${D}${qs({ owner_kind: ownerKind, owner_id: ownerId, include_archived: includeArchived || undefined })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<DocumentOut>(`${D}/${enc(id)}`, { signal }),
  upload: (input: DocumentUploadIn) =>
    apiRequest<DocumentOut>(D, {
      method: "POST",
      body: fileForm(input.file, {
        owner_kind: input.owner_kind,
        owner_id: input.owner_id,
        category: input.category,
        title: input.title,
        access_level: input.access_level,
        expires_on: input.expires_on,
      }),
    }),
  patch: (id: string, body: DocumentPatchIn) => apiRequest<DocumentOut>(`${D}/${enc(id)}`, { method: "PATCH", body }),
  archive: (id: string) => apiRequest<DocumentOut>(`${D}/${enc(id)}`, { method: "DELETE" }),
  addVersion: (id: string, file: File) => apiRequest<DocumentOut>(`${D}/${enc(id)}/versions`, { method: "POST", body: fileForm(file) }),
  supersede: (id: string, file: File) => apiRequest<DocumentOut>(`${D}/${enc(id)}/supersede`, { method: "POST", body: fileForm(file) }),

  // signature requests
  createRequest: (body: SignatureRequestIn) => apiRequest<SignatureRequestOut>(`${D}/signature-requests`, { method: "POST", body }),
  requests: (ownerKind: string, ownerId: string, signal?: AbortSignal) =>
    apiRequest<SignatureRequestOut[]>(`${D}/signature-requests${qs({ owner_kind: ownerKind, owner_id: ownerId })}`, { signal }),
  request: (id: string, signal?: AbortSignal) => apiRequest<SignatureRequestOut>(`${D}/signature-requests/${enc(id)}`, { signal }),
  sendRequest: (id: string) => apiRequest<SignatureRequestOut>(`${D}/signature-requests/${enc(id)}/send`, { method: "POST" }),
  cancelRequest: (id: string, reason: string) =>
    apiRequest<SignatureRequestOut>(`${D}/signature-requests/${enc(id)}/cancel`, { method: "POST", body: { reason } }),
  mySignatures: (signal?: AbortSignal) => apiRequest<MySignature[]>(`${D}/signers/mine`, { signal }),

  // verification
  verify: (file: File) => apiRequest<VerifyOut>(`${D}/verify`, { method: "POST", body: fileForm(file) }),

  // shared lists for the template editor
  legalEntities: (signal?: AbortSignal) => apiRequest<LegalEntityOption[]>("/api/v1/legal-entities", { signal }),
  esignConfigs: (signal?: AbortSignal) => apiRequest<EsignConfigOption[]>("/api/v1/connectors/configs?category=esign", { signal }),
};

export const documentKeys = {
  all: ["documents"] as const,
  mergeFields: ["documents", "merge-fields"] as const,
  templates: (kind: string | null, archived: boolean) => ["documents", "templates", kind, archived] as const,
  templatesAll: ["documents", "templates"] as const,
  template: (id: string) => ["documents", "template", id] as const,
  list: (ownerKind: string, ownerId: string, archived: boolean) => ["documents", "list", ownerKind, ownerId, archived] as const,
  listAll: ["documents", "list"] as const,
  detail: (id: string) => ["documents", "detail", id] as const,
  requests: (ownerKind: string, ownerId: string) => ["documents", "requests", ownerKind, ownerId] as const,
  requestsAll: ["documents", "requests"] as const,
  request: (id: string) => ["documents", "request", id] as const,
  legalEntities: ["documents", "legal-entities"] as const,
  esignConfigs: ["documents", "esign-configs"] as const,
};

export function useMergeCatalogue(enabled = true) {
  return useQuery({ queryKey: documentKeys.mergeFields, queryFn: ({ signal }) => documentsApi.mergeFields(signal), staleTime: 5 * 60_000, enabled });
}

export function useTemplates(kind: string | null, includeArchived: boolean, enabled = true) {
  return useQuery({
    queryKey: documentKeys.templates(kind, includeArchived),
    queryFn: ({ signal }) => documentsApi.templates(kind, includeArchived, signal),
    enabled,
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: documentKeys.template(id ?? ""),
    queryFn: ({ signal }) => documentsApi.template(id as string, signal),
    enabled: !!id,
  });
}

export function useLegalEntities() {
  return useQuery({ queryKey: documentKeys.legalEntities, queryFn: ({ signal }) => documentsApi.legalEntities(signal), staleTime: 5 * 60_000, retry: false });
}

/** eSign connector configs; a failure (no `connector:configure`) means "built-in only". */
export function useEsignConfigs() {
  return useQuery({ queryKey: documentKeys.esignConfigs, queryFn: ({ signal }) => documentsApi.esignConfigs(signal), staleTime: 5 * 60_000, retry: false });
}

export function useDocuments(ownerKind: string, ownerId: string, includeArchived: boolean) {
  return useQuery({
    queryKey: documentKeys.list(ownerKind, ownerId, includeArchived),
    queryFn: ({ signal }) => documentsApi.list(ownerKind, ownerId, includeArchived, signal),
  });
}

export function useDocument(id: string | null) {
  return useQuery({ queryKey: documentKeys.detail(id ?? ""), queryFn: ({ signal }) => documentsApi.get(id as string, signal), enabled: !!id });
}

export function useSignatureRequests(ownerKind: string, ownerId: string, enabled = true) {
  return useQuery({
    queryKey: documentKeys.requests(ownerKind, ownerId),
    queryFn: ({ signal }) => documentsApi.requests(ownerKind, ownerId, signal),
    enabled,
  });
}

export function useSignatureRequest(id: string | null) {
  return useQuery({ queryKey: documentKeys.request(id ?? ""), queryFn: ({ signal }) => documentsApi.request(id as string, signal), enabled: !!id });
}

/** Invalidate every documents query (lists, details, requests) after a write. */
export function useInvalidateDocuments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: documentKeys.all });
}

export function useDocumentMutation<TArgs, TOut>(fn: (args: TArgs) => Promise<TOut>) {
  const invalidate = useInvalidateDocuments();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate() });
}
