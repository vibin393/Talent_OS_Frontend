/** User-facing messages for the clients/contacts API error codes (Epic 2). */
import { adminErrorMessage } from "@/features/admin/errors";
import { isApiError } from "@/lib/api/errors";

const MESSAGES: Record<string, string> = {
  client_exists: "A client with this name already exists.",
  contact_exists: "This client already has a contact with this email address.",
  client_archived: "This client is archived. Restore it first.",
  invalid_reference: "The selected owner is not an active user of this workspace.",
};

export function clientErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    const known = MESSAGES[e.code];
    if (known) return known;
    if (e.status === 404) return "This client or contact no longer exists, or you cannot see it.";
  }
  return adminErrorMessage(e);
}
