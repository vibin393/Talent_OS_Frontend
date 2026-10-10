/** Pure logic of the `vendor_data_notice` public page (Epic 17, FR-95). */
import type { PublicLinkView } from "@/lib/api/types";

export type NoticeScreen = "notice" | "granted" | "withdrawn";

/** Initial screen of a `vendor_data_notice` link from its status (`pending | granted | withdrawn`). */
export function noticeScreen(status: string | null | undefined): NoticeScreen {
  if (status === "granted") return "granted";
  if (status === "withdrawn") return "withdrawn";
  return "notice";
}

/** Intro copy: who shared the profile with whom, for which role. */
export function noticeIntro(view: Pick<PublicLinkView, "tenant_name" | "job_title" | "candidate_first_name">): string {
  const hello = view.candidate_first_name ? `Hello ${view.candidate_first_name}, ` : "";
  const who = view.tenant_name ?? "The hiring organisation";
  const role = view.job_title ? ` for the role "${view.job_title}"` : "";
  return `${hello}a staffing vendor shared your profile with ${who}${role}. ${who} processes your personal data to evaluate you. You can agree, or withdraw your consent at any time.`;
}
