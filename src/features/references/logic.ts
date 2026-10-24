/** Pure reference-check rules (Vitest): referee form validation, E.164 phone normalisation, public answers. */

export type RefereeDraft = { name: string; relationship: string; company: string; email: string; phone: string };
export type RefereeErrors = Partial<Record<keyof RefereeDraft, string>>;
export type Question = { key: string; text: string; kind: "text" | "rating" | "yes_no"; required: boolean };
export type AnswerValue = string | number | boolean | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; // NOSONAR

export function emptyReferee(): RefereeDraft {
  return { name: "", relationship: "", company: "", email: "", phone: "" };
}

/** E.164 with India (+91) as the default for 10-digit mobile numbers; `null` for blank, `undefined` if invalid. */
export function normalisePhone(value: string): string | null | undefined {
  const raw = value.trim();
  if (!raw) return null;
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) {
    if (/^[6-9]\d{9}$/.test(digits)) digits = `+91${digits}`;
    else if (/^91\d{10}$/.test(digits)) digits = `+${digits}`;
    else return undefined;
  }
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : undefined;
}

/** Validate the referee list: names, emails (never the candidate's own, no duplicates) and phones. */
export function validateReferees(list: RefereeDraft[], ownEmail: string | null, minReferees: number): { errors: RefereeErrors[]; form: string | null } {
  const seen = new Set<string>();
  const own = (ownEmail ?? "").trim().toLowerCase();
  const errors = list.map((r) => {
    const e: RefereeErrors = {};
    if (r.name.trim().length < 2) e.name = "Enter the referee's name.";
    const email = r.email.trim().toLowerCase();
    if (!EMAIL.test(email)) e.email = "Enter a valid email address.";
    else if (own && email === own) e.email = "You cannot be your own referee.";
    else if (seen.has(email)) e.email = "This referee is already listed.";
    seen.add(email);
    if (normalisePhone(r.phone) === undefined) e.phone = "Enter the phone number with its country code.";
    return e;
  });
  const form = list.length < minReferees ? `Add at least ${minReferees} referees.` : null;
  return { errors, form };
}

export function hasErrors(result: { errors: RefereeErrors[]; form: string | null }): boolean {
  return result.form !== null || result.errors.some((e) => Object.keys(e).length > 0);
}

/** Public questionnaire: required answers present, ratings 1-5, yes/no booleans. */
export function validateReferenceAnswers(questions: Question[], answers: Record<string, AnswerValue>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const v = answers[q.key];
    if (v === undefined || v === null || v === "") {
      if (q.required) errors[q.key] = "Required";
      continue;
    }
    if (q.kind === "rating" && (typeof v !== "number" || v < 1 || v > 5)) errors[q.key] = "Choose 1 to 5";
    if (q.kind === "yes_no" && typeof v !== "boolean") errors[q.key] = "Answer yes or no";
    if (q.kind === "text" && (typeof v !== "string" || v.length > 4000)) errors[q.key] = "Up to 4000 characters";
  }
  return errors;
}
