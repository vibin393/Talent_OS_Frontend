/**
 * Browser calls of the public apply flow (`/api/v1/public/careers/{slug}/...`). No cookies are needed;
 * the apply session is carried by the `X-Apply-Token` header (the token only lives in memory).
 */
import { ApiError, toApiError } from "@/lib/api/errors";
import type { ApplySessionCreate, ApplySubmit, PublicApplySession, PublicResumeResult, PublicStatus } from "@/lib/api/types";

const enc = encodeURIComponent;
const base = (slug: string) => `/api/v1/public/careers/${enc(slug)}`;

function parse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (token) headers["X-Apply-Token"] = token;
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), credentials: "omit", cache: "no-store" });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const data = parse(await res.text().catch(() => ""));
  if (!res.ok) throw toApiError(res.status, data);
  return data as T;
}

/** Multipart upload with progress (XHR: `fetch` cannot report upload progress). */
function uploadWithProgress<T>(url: string, file: File, token: string, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("X-Apply-Token", token);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      const data = parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(toApiError(xhr.status, data));
    };
    xhr.onerror = () => reject(new ApiError(0, "network_error", "Cannot reach the server"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export const applyApi = {
  createSession: (slug: string, postingId: string, body: ApplySessionCreate) =>
    postJson<PublicApplySession>(`${base(slug)}/postings/${enc(postingId)}/apply-sessions`, body),
  uploadResume: (slug: string, token: string, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal) =>
    uploadWithProgress<PublicResumeResult>(`${base(slug)}/apply-sessions/resume`, file, token, onProgress, signal),
  submit: (slug: string, token: string, body: ApplySubmit) => postJson<PublicStatus>(`${base(slug)}/apply-sessions/submit`, body, token),
};
