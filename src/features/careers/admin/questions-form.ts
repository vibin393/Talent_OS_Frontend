/** Apply-question editor model (`PATCH /demands/{id}/posting`, Epic 6 question schema). Pure. */
import type { PostingQuestion, PublicApplyQuestion } from "@/lib/api/types";

export const MAX_QUESTIONS = 10;

export const QUESTION_TYPES: { value: PostingQuestion["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "boolean", label: "Yes / no" },
  { value: "choice", label: "Choice" },
  { value: "number", label: "Number" },
  { value: "money", label: "Amount" },
  { value: "rating", label: "Rating 1–5" },
  { value: "date", label: "Date" },
];

export const MAPS_TO: { value: NonNullable<PostingQuestion["maps_to"]>; label: string }[] = [
  { value: "expected_ctc", label: "Expected pay" },
  { value: "notice_period_days", label: "Notice period (days)" },
  { value: "current_location", label: "Current location" },
  { value: "work_authorization", label: "Work authorization" },
  { value: "willing_to_relocate", label: "Willing to relocate" },
];

export type QuestionDraft = {
  key: string;
  label: string;
  type: PostingQuestion["type"];
  options: string;
  required: boolean;
  maps_to: PostingQuestion["maps_to"] | "";
};

/** A stable `^[a-z0-9_]{1,60}$` key from a label (unique within `taken`). */
export function questionKey(label: string, taken: readonly string[] = []): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") // NOSONAR
      .slice(0, 50) || "question";
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}_${i}`;
  return key;
}

export function emptyQuestion(taken: readonly string[]): QuestionDraft {
  return { key: questionKey("question", taken), label: "", type: "text", options: "", required: false, maps_to: "" };
}

export function fromPublic(q: PublicApplyQuestion): QuestionDraft {
  return {
    key: q.key,
    label: q.label,
    type: q.type as PostingQuestion["type"],
    options: (q.options ?? []).join("\n"),
    required: q.required,
    maps_to: "",
  };
}

const optionList = (raw: string) =>
  raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/** Errors keyed `<index>.<field>`. */
export function validateQuestions(list: readonly QuestionDraft[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (list.length > MAX_QUESTIONS) e.list = `Add at most ${MAX_QUESTIONS} questions`;
  const seen = new Set<string>();
  list.forEach((q, i) => {
    if (!q.label.trim()) e[`${i}.label`] = "Enter the question";
    else if (q.label.trim().length > 500) e[`${i}.label`] = "Keep the question under 500 characters";
    if (!/^[a-z0-9_]{1,60}$/.test(q.key)) e[`${i}.key`] = "Use lowercase letters, digits and _ only";
    else if (seen.has(q.key)) e[`${i}.key`] = "Each question needs a unique key";
    seen.add(q.key);
    if (q.type === "choice") {
      const opts = optionList(q.options);
      if (opts.length < 2) e[`${i}.options`] = "Add at least two options, one per line";
      else if (opts.length > 50) e[`${i}.options`] = "Add at most 50 options";
      else if (opts.some((o) => o.length > 200)) e[`${i}.options`] = "Keep options under 200 characters";
    }
  });
  return e;
}

export function toQuestions(list: readonly QuestionDraft[]): PostingQuestion[] {
  return list.map((q) => ({
    key: q.key,
    label: q.label.trim(),
    type: q.type,
    options: q.type === "choice" ? optionList(q.options) : null,
    required: q.required,
    maps_to: q.maps_to || null,
  }));
}
