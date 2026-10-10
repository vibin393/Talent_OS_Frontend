import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { fieldErrors } from "@/lib/api/errors";

/**
 * Map a 422 envelope's field errors onto the form (focusing the first one).
 * Returns true if at least one known field received an error.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  known: readonly Path<T>[],
): boolean {
  const fields = fieldErrors(error);
  let first = true;
  for (const name of known) {
    const message = fields[name];
    if (!message) continue;
    setError(name, { type: "server", message }, { shouldFocus: first });
    first = false;
  }
  return !first;
}
