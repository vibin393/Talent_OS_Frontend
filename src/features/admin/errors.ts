/** User-facing messages for the administration API's error codes (story 1.5). */
import { errorMessage, isApiError } from "@/lib/api/errors";

const MESSAGES: Record<string, string> = {
  forbidden: "You do not have permission to do this.",
  seat_limit_reached: "All seats are in use. Deactivate a user or revoke a pending invitation first.",
  user_exists: "A user with this email already exists.",
  invitation_pending: "This email already has a pending invitation. Resend it from Pending invitations.",
  invitation_accepted: "This invitation has already been accepted.",
  invitation_revoked: "This invitation has been revoked.",
  last_admin: "The organization must keep at least one active Tenant Admin.",
  cannot_deactivate_self: "You cannot deactivate your own account.",
  self_scope_change: "You cannot change your own teams or business unit.",
  role_exists: "A role with this key already exists.",
  role_in_use: "This role is assigned to users. Remove it from them before deleting it.",
  system_role: "System roles cannot be deleted, and their key cannot be changed.",
  invalid_permission: "One of the permissions or scopes is not valid.",
  invalid_reference: "A selected role, team or business unit no longer exists. Refresh and try again.",
  team_exists: "A team with this name already exists.",
  business_unit_exists: "A business unit with this name already exists.",
  business_unit_in_use: "This business unit is still in use by users or teams. Move them first.",
};

/** Message for an admin mutation failure (known codes first, then the generic mapping). */
export function adminErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === "forbidden" && typeof e.details.permission === "string") {
      return `You need the "${e.details.permission}" permission to do this.`;
    }
    const known = MESSAGES[e.code];
    if (known) return known;
    if (e.status === 404) return "This item no longer exists. Refresh and try again.";
  }
  return errorMessage(e);
}
