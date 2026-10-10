// Remembers the last used workspace (tenant slug) in localStorage. Storage may be unavailable
// (private mode, blocked site data), so every access is guarded.
const KEY = "tos:last-workspace";

export function getLastWorkspace(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setLastWorkspace(slug: string): void {
  try {
    if (slug) window.localStorage.setItem(KEY, slug);
  } catch {
    // ignore
  }
}
