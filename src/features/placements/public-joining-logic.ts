/** Pure state helpers of the public joining-confirmation page (Epic 19). */
import { isApiError } from "@/lib/api/errors";
import type { PublicLinkView } from "@/lib/api/types";
import type { JoiningLinkInfo } from "./types";

export type JoiningState = "form" | "confirmed" | "question_sent" | "responded";

/** Initial screen of a `joining_confirmation` link. */
export function joiningScreen(view: Pick<PublicLinkView, "status"> & { joining?: JoiningLinkInfo | null }): JoiningState {
  return view.joining?.responded || view.status === "responded" ? "responded" : "form";
}

export function joiningErrorMessage(error: unknown): string {
  if (!isApiError(error)) return "Something went wrong. Please try again.";
  if (error.status === 410) return "This link has already been used or has expired.";
  if (error.status === 404) return "This link is not valid.";
  return error.message || "Something went wrong. Please try again.";
}
