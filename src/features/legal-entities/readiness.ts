import { missingLabel } from "./gstin";
import type { ReadinessOut } from "./types";

/** FR-76 prompt shown before the first Invoice, or null when the entity is ready. */
export function readinessBannerText(readiness: ReadinessOut | undefined): string | null {
  if (!readiness || readiness.ready_for_invoicing) return null;
  if (readiness.missing.length === 0) return "This legal entity is inactive and cannot issue invoices.";
  return `Complete ${missingLabel(readiness.missing)} before your first Invoice.`;
}
