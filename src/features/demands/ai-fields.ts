/** Pure helpers for AI-extracted demand fields (`ai_extracted_fields`, story 4.4). */

export const AI_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  mandatory_skills: "Mandatory skills",
  preferred_skills: "Preferred skills",
  min_experience_years: "Minimum experience",
  max_experience_years: "Maximum experience",
  positions: "Positions",
  location: "Location",
  country: "Country",
  work_mode: "Work mode",
  bill_rate: "Bill rate",
  pay_rate_min: "Pay rate (min)",
  pay_rate_max: "Pay rate (max)",
  currency: "Currency",
  rate_unit: "Rate unit",
  start_date: "Start date",
  employment_type: "Employment type",
  certifications: "Certifications",
};

export function aiFieldLabel(field: string): string {
  return AI_FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

/** The AI-extracted fields among `fields` that are still awaiting confirmation. */
export function pendingAiFields(extracted: readonly string[] | null | undefined, fields: readonly string[]): string[] {
  const set = new Set(extracted ?? []);
  return fields.filter((f) => set.has(f));
}

/** `ai_extracted_fields` after confirming `fields` (all when omitted). */
export function afterConfirm(extracted: readonly string[], fields?: readonly string[]): string[] {
  if (!fields) return [];
  const done = new Set(fields);
  return extracted.filter((f) => !done.has(f));
}

/**
 * Epic 55: tooltip of the "AI-extracted" badge. With the Demand Agent's verbatim source quote:
 * `AI-extracted from the client email: “{quote}”`; without one, the P1 text.
 */
export function aiFieldTooltip(label: string, sourceQuote?: string | null): string {
  const quote = (sourceQuote ?? "").trim();
  if (quote) return `AI-extracted from the client email: “${quote}”`;
  return `${label} was extracted by AI. Check it, then confirm or edit it.`;
}
