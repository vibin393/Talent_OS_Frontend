/** Pure helpers for the interview kit editor (competency / question keys, validation, payload). */
import type { KitCreate, KitOut } from "./types";

export type KitDraft = {
  name: string;
  description: string;
  ratingScale: number;
  competencies: { key: string; label: string; guidance: string }[];
  questions: { key: string; competencyKey: string | null; text: string; guidance: string }[];
};

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,49}$/;

/** A stable key from a label ("System design" → "system_design"), unique among `taken`. */
export function keyFor(label: string, taken: readonly string[], fallback = "item"): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || fallback;
  const start = /^[a-z0-9]/.test(base) ? base : `${fallback}_${base}`;
  let key = start;
  for (let n = 2; taken.includes(key); n++) key = `${start}_${n}`;
  return key;
}

export function emptyKit(scale = 5): KitDraft {
  return { name: "", description: "", ratingScale: scale, competencies: [{ key: "", label: "", guidance: "" }], questions: [] };
}

export function kitDraftFrom(kit: KitOut): KitDraft {
  return {
    name: kit.name,
    description: kit.description ?? "",
    ratingScale: kit.rating_scale,
    competencies: kit.competencies.map((c) => ({ key: c.key, label: c.label, guidance: c.guidance ?? "" })),
    questions: kit.questions.map((q) => ({ key: q.key, competencyKey: q.competency_key ?? null, text: q.text, guidance: q.guidance ?? "" })),
  };
}

export function validateKit(d: KitDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.name.trim()) e.name = "Name the kit";
  if (!Number.isInteger(d.ratingScale) || d.ratingScale < 3 || d.ratingScale > 10) e.ratingScale = "Use a scale from 3 to 10";
  const filled = d.competencies.filter((c) => c.label.trim());
  if (filled.length === 0) e.competencies = "Add at least one competency";
  d.questions.forEach((q, i) => {
    if (!q.text.trim()) e[`question-${i}`] = "Write the question or remove it";
  });
  return e;
}

/** The API body; missing keys are generated from labels / question text and kept unique. */
export function toKitPayload(d: KitDraft): KitCreate {
  const ckeys: string[] = [];
  const competencies = d.competencies
    .filter((c) => c.label.trim())
    .map((c) => {
      const key = c.key && KEY_RE.test(c.key) && !ckeys.includes(c.key) ? c.key : keyFor(c.label, ckeys, "competency");
      ckeys.push(key);
      return { key, label: c.label.trim(), guidance: c.guidance.trim() || null };
    });
  const qkeys: string[] = [];
  const questions = d.questions
    .filter((q) => q.text.trim())
    .map((q, i) => {
      const key = q.key && KEY_RE.test(q.key) && !qkeys.includes(q.key) ? q.key : keyFor(`q${i + 1}`, qkeys, "q");
      qkeys.push(key);
      return {
        key,
        competency_key: q.competencyKey && ckeys.includes(q.competencyKey) ? q.competencyKey : null,
        text: q.text.trim(),
        guidance: q.guidance.trim() || null,
      };
    });
  return { name: d.name.trim(), description: d.description.trim() || null, rating_scale: d.ratingScale, competencies, questions };
}
