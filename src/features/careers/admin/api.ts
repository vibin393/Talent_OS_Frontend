import { api } from "@/lib/api/client";
import type { CareerSiteOut, CareerSiteUpdate, PostingQuestion, PostingQuestionsOut, PublicApplyForm } from "@/lib/api/types";

const A = "/api/v1/admin/career-site";
const enc = encodeURIComponent;

function upload(which: "logo" | "header", file: File) {
  const form = new FormData();
  form.append("file", file);
  return api.post<CareerSiteOut>(`${A}/${which}`, form);
}

export const careerSiteApi = {
  get: (signal?: AbortSignal) => api.get<CareerSiteOut>(A, { signal }),
  update: (body: CareerSiteUpdate) => api.patch<CareerSiteOut>(A, body),
  uploadLogo: (file: File) => upload("logo", file),
  uploadHeader: (file: File) => upload("header", file),
  setApplyQuestions: (demandId: string, questions: PostingQuestion[]) =>
    api.patch<PostingQuestionsOut>(`/api/v1/demands/${enc(demandId)}/posting`, { apply_questions: questions }),
  /** Current apply questions as candidates see them (public apply form; needs an enabled site and a live posting). */
  publicApplyForm: (tenantSlug: string, postingId: string, signal?: AbortSignal) =>
    api.get<PublicApplyForm>(`/api/v1/public/careers/${enc(tenantSlug)}/postings/${enc(postingId)}/apply-form`, { signal, skipAuthHandler: true }),
};

export const careerSiteKeys = {
  site: ["career-site"] as const,
  applyQuestions: (postingId: string) => ["career-site", "apply-questions", postingId] as const,
};
