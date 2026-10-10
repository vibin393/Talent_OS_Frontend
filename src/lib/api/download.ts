/**
 * Download a same-origin `/api/...` file (e.g. a CSV export) with the session cookie, surfacing API
 * errors as `ApiError` and saving the body through a temporary object URL.
 */
import { ApiError, toApiError } from "./errors";

/** File name from a `Content-Disposition` header (`filename*=` preferred), or null. */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain parameter
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

export async function downloadApiFile(path: string, fallbackName: string): Promise<{ headers: Headers }> {
  if (!path.startsWith("/api/")) throw new Error(`downloadApiFile only accepts relative /api/ paths, got "${path}"`);
  let res: Response;
  try {
    res = await fetch(path, { credentials: "include", cache: "no-store" });
  } catch {
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
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { headers: res.headers };
}
