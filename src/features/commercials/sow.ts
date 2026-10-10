/**
 * Epic 45 SOW terms: a SOW needs a pricing model and a total value (`value_cap`) before it can be submitted
 * for approval or activated (`422 sow_terms_required`). Pure helpers for the contract form and detail.
 */
import { isApiError } from "@/lib/api/errors";
import type { ContractType, PricingModel } from "./types";

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  time_and_materials: "Time & materials",
  fixed_price: "Fixed price",
  milestone: "Milestone-based",
};
export const PRICING_MODELS = Object.keys(PRICING_MODEL_LABELS) as PricingModel[];

export type SowTermField = "pricing_model" | "value_cap";
export const SOW_TERM_LABELS: Record<SowTermField, string> = { pricing_model: "Pricing model", value_cap: "Total value" };

/** Label of the `value_cap` money input for a contract type. */
export function valueCapLabel(type: ContractType): string {
  return type === "sow" ? "Total value" : "Value cap (informational)";
}

/** SOW terms still missing (empty for other contract types). */
export function missingSowTerms(c: { contract_type: ContractType; pricing_model?: PricingModel | null; value_cap?: string | null }): SowTermField[] {
  if (c.contract_type !== "sow") return [];
  const out: SowTermField[] = [];
  if (!c.pricing_model) out.push("pricing_model");
  const v = (c.value_cap ?? "").trim();
  if (!v || !(Number(v) > 0)) out.push("value_cap");
  return out;
}

/** The fields named by a `422 sow_terms_required` error (falls back to both), or null for any other error. */
export function sowTermsError(e: unknown): SowTermField[] | null {
  if (!isApiError(e) || e.code !== "sow_terms_required") return null;
  const raw = e.details.fields ?? e.details.missing;
  const names: string[] = Array.isArray(raw)
    ? raw.map((f) => (typeof f === "string" ? f : f && typeof f === "object" && "field" in f ? String((f as { field: unknown }).field) : "")).map((f) => f.split(".").pop() ?? f)
    : [];
  const fields = names.map((n) => (n === "total_value" ? "value_cap" : n)).filter((n): n is SowTermField => n === "pricing_model" || n === "value_cap");
  return fields.length ? [...new Set(fields)] : ["pricing_model", "value_cap"];
}
