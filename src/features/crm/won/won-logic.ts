/** Won dialog selection state, request body, summary and idempotency (pure, unit-tested). */
import { newKey } from "../format";
import type { ContractType, WinDemandOverrides, WinIn, WonPreviewOut } from "../types";

export type DemandRow = {
  lineId: string;
  create: boolean;
  title: string;
  positions: number;
  location: string;
  billRate: string;
  currency: string;
  rateUnit: string | null;
  original: { title: string; positions: number; location: string; billRate: string };
};

export type WonSelection = {
  activateClient: boolean;
  createContract: boolean;
  contractType: ContractType;
  contractTitle: string;
  legalEntityId: string | null;
  startDate: string;
  endDate: string;
  fileIds: string[];
  copyRateCard: boolean;
  templateId: string | null;
  effectiveFrom: string;
  demands: DemandRow[];
};

export function selectionFromPreview(p: WonPreviewOut): WonSelection {
  return {
    activateClient: p.client.will_activate,
    createContract: p.commercials_available,
    contractType: p.contract.type,
    contractTitle: p.contract.title,
    legalEntityId: p.contract.legal_entity_id ?? p.legal_entities[0]?.id ?? null,
    startDate: p.contract.start_date,
    endDate: "",
    fileIds: [],
    copyRateCard: p.commercials_available && p.rate_card_templates.length > 0,
    templateId: p.rate_card_templates[0]?.id ?? null,
    effectiveFrom: p.contract.start_date,
    demands: p.demands.map((d) => {
      const original = { title: d.title, positions: d.positions, location: d.location ?? "", billRate: d.bill_rate ?? "" };
      return { lineId: d.line_id, create: true, ...original, currency: d.currency, rateUnit: d.rate_unit, original };
    }),
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "This will create: 1 Contract, 1 Rate Card, 3 Demands" (plus client activation). */
export function selectionSummary(s: WonSelection): string {
  const parts: string[] = [];
  if (s.createContract) parts.push(plural(1, "Contract", "Contracts"));
  if (s.copyRateCard && s.templateId) parts.push(plural(1, "Rate Card", "Rate Cards"));
  const demands = s.demands.filter((d) => d.create).length;
  if (demands) parts.push(plural(demands, "Demand", "Demands"));
  const create = parts.length ? `This will create: ${parts.join(", ")}` : "No new records will be created";
  return s.activateClient ? `${create} and activate the client` : create;
}

/** WinIn request body; demand overrides only carry changed fields. */
export function buildWinIn(s: WonSelection): WinIn {
  return {
    activate_client: s.activateClient,
    contract: s.createContract
      ? {
          create: true,
          type: s.contractType,
          title: s.contractTitle.trim() || null,
          legal_entity_id: s.legalEntityId,
          start_date: s.startDate || null,
          end_date: s.endDate || null,
          file_ids: s.fileIds,
        }
      : null,
    rate_card: s.copyRateCard && s.templateId ? { template_id: s.templateId, effective_from: s.effectiveFrom } : null,
    demands: s.demands.map((d) => {
      const o: WinDemandOverrides = {};
      if (d.title.trim() !== d.original.title) o.title = d.title.trim();
      if (d.positions !== d.original.positions) o.positions = d.positions;
      if (d.location.trim() !== d.original.location) o.location = d.location.trim() || null;
      if (d.billRate.trim() !== d.original.billRate && d.billRate.trim()) o.bill_rate = d.billRate.trim();
      return { line_id: d.lineId, create: d.create, overrides: Object.keys(o).length ? o : null };
    }),
  };
}

/** Validation messages blocking Confirm. */
export function selectionErrors(s: WonSelection): string[] {
  const errs: string[] = [];
  if (s.createContract && !s.startDate) errs.push("Contract start date is required.");
  if (s.createContract && !s.legalEntityId) errs.push("Choose a legal entity for the contract.");
  if (s.copyRateCard && (!s.templateId || !s.effectiveFrom)) errs.push("Choose a rate card template and effective date.");
  for (const d of s.demands) {
    if (d.create && !d.title.trim()) errs.push("Every selected demand needs a title.");
    if (d.create && (!Number.isInteger(d.positions) || d.positions < 1)) errs.push("Positions must be at least 1.");
    if (d.create && d.billRate.trim() && !/^\d+(\.\d{1,4})?$/.test(d.billRate.trim())) errs.push("Bill rate must be a number.");
  }
  return [...new Set(errs)];
}

/**
 * One Won dialog "session": the Idempotency-Key is generated once when the dialog opens and reused for
 * every retry, so a replayed request never creates records twice.
 */
export function createWinSession(makeKey: () => string = newKey) {
  const key = makeKey();
  return {
    key,
    submit<T>(send: (key: string) => Promise<T>): Promise<T> {
      return send(key);
    },
  };
}
