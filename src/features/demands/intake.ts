/** Pure client-side checks for the AI intake dialog (the API re-checks by magic bytes). */

export const MAX_INTAKE_BYTES = 10 * 1024 * 1024;
export const MAX_INTAKE_CHARS = 60_000;
export const INTAKE_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ALLOWED_EXT = [".pdf", ".docx"];

/** Error message for a dropped/picked file, or null when it may be uploaded. */
export function validateIntakeFile(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => name.endsWith(ext))) return "Only PDF and DOCX files are supported.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_INTAKE_BYTES) return "The file is larger than 10 MB.";
  return null;
}

/** Error message for pasted text, or null. */
export function validateIntakeText(text: string): string | null {
  if (!text.trim()) return "Paste the requirement text.";
  if (text.length > MAX_INTAKE_CHARS) return "The text is too long (at most 60,000 characters).";
  return null;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
