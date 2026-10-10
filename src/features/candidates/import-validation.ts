/** Client-side pre-validation of a bulk import selection (the server re-checks every limit). */

export const MAX_IMPORT_FILES = 200;
export const MAX_FILE_MB = 10;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
/** Upper bound for the ZIP archive itself (the server caps the uncompressed size at 200 MB). */
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;

export const RESUME_EXTENSIONS = [".pdf", ".docx"] as const;
export const ATTACHMENT_EXTENSIONS = [".pdf", ".docx", ".png", ".jpg", ".jpeg"] as const;

export type FileLike = { name: string; size: number };

export type ImportCheck = {
  ok: boolean;
  /** Blocking problems: nothing is uploaded while there are any. */
  errors: string[];
  /** Files that will probably fail on the server (reported per item after upload). */
  warnings: string[];
  isZip: boolean;
};

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export function isZipFile(f: FileLike): boolean {
  return ext(f.name) === ".zip";
}

export function hasExtension(f: FileLike, allowed: readonly string[]): boolean {
  return allowed.includes(ext(f.name));
}

/**
 * Either one `.zip` (≤200 MB) or up to 200 PDF/DOCX files of ≤10 MB each. Oversized files block the
 * upload; other extensions only warn, because the server sniffs content and fails that item alone.
 */
export function validateImportFiles(files: readonly FileLike[]): ImportCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (files.length === 0) return { ok: false, errors: ["Choose at least one file."], warnings, isZip: false };

  const zips = files.filter(isZipFile);
  if (zips.length > 0) {
    if (files.length > 1) {
      errors.push("Upload either a single .zip file or individual resumes, not both.");
    } else if (zips[0].size > MAX_ZIP_BYTES) {
      errors.push(`${zips[0].name} is larger than 200 MB.`);
    } else if (zips[0].size === 0) {
      errors.push(`${zips[0].name} is empty.`);
    }
    return { ok: errors.length === 0, errors, warnings, isZip: files.length === 1 };
  }

  if (files.length > MAX_IMPORT_FILES) {
    errors.push(`You can import at most ${MAX_IMPORT_FILES} files at once (${files.length} selected).`);
  }
  const tooLarge = files.filter((f) => f.size > MAX_FILE_BYTES);
  if (tooLarge.length > 0) {
    const names = tooLarge.slice(0, 3).map((f) => f.name).join(", ");
    errors.push(
      `${tooLarge.length} file${tooLarge.length === 1 ? " is" : "s are"} larger than ${MAX_FILE_MB} MB: ${names}${
        tooLarge.length > 3 ? ", …" : ""
      }`,
    );
  }
  const empty = files.filter((f) => f.size === 0);
  if (empty.length > 0) warnings.push(`${empty.length} empty file${empty.length === 1 ? "" : "s"} will fail.`);
  const other = files.filter((f) => !hasExtension(f, RESUME_EXTENSIONS));
  if (other.length > 0) {
    warnings.push(
      `${other.length} file${other.length === 1 ? " is" : "s are"} not PDF or DOCX and will probably fail: ${other
        .slice(0, 3)
        .map((f) => f.name)
        .join(", ")}${other.length > 3 ? ", …" : ""}`,
    );
  }
  return { ok: errors.length === 0, errors, warnings, isZip: false };
}

/** Single-file check for resume / attachment uploads. Returns an error message or null. */
export function validateSingleUpload(file: FileLike, allowed: readonly string[]): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than ${MAX_FILE_MB} MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (!hasExtension(file, allowed)) return `Choose a ${allowed.map((e) => e.slice(1).toUpperCase()).join(", ")} file.`;
  return null;
}

const TERMINAL_ITEM_STATUSES = ["created", "linked", "needs_review", "failed"] as const;

/** Share (0..1) of an import batch's items that reached a terminal status. */
export function importProgress(total: number, counts: Record<string, number>): number {
  if (total <= 0) return 1;
  const done = TERMINAL_ITEM_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0);
  return Math.min(1, done / total);
}
