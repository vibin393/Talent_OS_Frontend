/**
 * Pure screening-questionnaire helpers shared by the recruiter screening form, the AI screening editor
 * and the public AI-screening page. They mirror `normalize_answers` on the server (which stays
 * authoritative) so errors show before a round trip.
 */

export type QuestionType = "text" | "number" | "boolean" | "choice" | "rating" | "money" | "date";

export type QuestionLike = {
  key: string;
  label: string;
  type: string;
  options?: string[] | null;
  required?: boolean;
};

export type MoneyAnswer = { amount: string; currency: string | null };
export type AnswerValue = string | number | boolean | MoneyAnswer | null | undefined;
export type Answers = Record<string, AnswerValue>;

export function isEmptyAnswer(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object" && "amount" in (value as object)) {
    const amount = (value as MoneyAnswer).amount;
    return amount === null || amount === undefined || String(amount).trim() === "";
  }
  return false;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Per-question error message for one answer (null when valid or empty). */
export function answerError(q: QuestionLike, value: unknown): string | null {
  if (isEmptyAnswer(value)) return null;
  switch (q.type) {
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return "Enter a number.";
      if (n < 0) return "Enter a number of 0 or more.";
      return null;
    }
    case "rating": {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 1 || n > 5) return "Choose a rating from 1 to 5.";
      return null;
    }
    case "choice":
      return (q.options ?? []).includes(String(value)) ? null : "Choose one of the options.";
    case "boolean":
      return typeof value === "boolean" || value === "yes" || value === "no" ? null : "Answer yes or no.";
    case "money": {
      const amount = typeof value === "object" && value !== null ? (value as MoneyAnswer).amount : value;
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0) return "Enter an amount.";
      return null;
    }
    case "date":
      return DATE_RE.test(String(value)) && !Number.isNaN(Date.parse(String(value))) ? null : "Enter a date (YYYY-MM-DD).";
    default:
      return String(value).length > 4000 ? "Keep the answer under 4,000 characters." : null;
  }
}

/**
 * Errors keyed by question key. With `requireAll` (submitting the public form, or completing a recruiter
 * screening) unanswered required questions are errors too.
 */
export function validateAnswers(questions: readonly QuestionLike[], answers: Answers, requireAll: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of questions) {
    const value = answers[q.key];
    if (isEmptyAnswer(value)) {
      if (requireAll && q.required) out[q.key] = "This question is required.";
      continue;
    }
    const err = answerError(q, value);
    if (err) out[q.key] = err;
  }
  return out;
}

/** Drop empty answers and coerce numbers so the payload matches the server's expectations. */
export function cleanAnswers(questions: readonly QuestionLike[], answers: Answers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    const value = answers[q.key];
    if (isEmptyAnswer(value)) continue;
    if (q.type === "number" || q.type === "rating") out[q.key] = Number(value);
    else if (q.type === "money") {
      const m = typeof value === "object" && value !== null ? (value as MoneyAnswer) : { amount: String(value), currency: null };
      out[q.key] = { amount: String(m.amount).trim(), currency: m.currency || null };
    } else out[q.key] = typeof value === "string" ? value.trim() : value;
  }
  return out;
}

/** Display text of a stored answer (screening review, history). */
export function formatAnswer(q: QuestionLike | undefined, value: unknown): string {
  if (isEmptyAnswer(value)) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object" && value !== null && "amount" in value) {
    const m = value as MoneyAnswer;
    return [m.amount, m.currency].filter(Boolean).join(" ");
  }
  if (Array.isArray(value)) return value.map((v) => formatAnswer(undefined, v)).join(", ");
  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>)
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map(String)
      .join(", ") || "—";
  }
  if (q?.type === "rating") return `${String(value)} / 5`;
  return String(value);
}

/** A stable question key from a label (admin questionnaire editor, AI question editor). */
export function questionKey(label: string, taken: ReadonlySet<string>): string {
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") // NOSONAR
    .slice(0, 50);
  if (!base) base = "question";
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`.slice(0, 60);
  return key;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / no",
  choice: "Choice",
  rating: "Rating (1–5)",
  money: "Amount",
  date: "Date",
};
