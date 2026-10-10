/** 26AS / AIS TDS reconciliation (Epic 51 Part A2/B). Hand-written: `gen:api` is not run for this epic. */

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type StatementKind = "26as" | "ais";

export type TdsRun = {
  id: string;
  legal_entity_id: string;
  fy: string;
  quarter: Quarter;
  statement_kind: StatementKind;
  source: "upload" | "connector";
  status: "parsing" | "ready" | "failed" | "superseded";
  line_count: number;
  error: string | null;
  created_by: string | null;
  created_at: string;
  proposed: number;
  confirmed: number;
  unmatched: number;
};

export type TdsDeductionRef = {
  id: string;
  client_id: string;
  client_name: string | null;
  section_code: string | null;
  inr_amount: string;
  deduction_date: string;
  quarter: string;
  invoice_id: string | null;
};

export type TdsMatchStatus = "proposed" | "confirmed" | "rejected" | "unmatched_ack";

export type TdsMatch = {
  id: string;
  statement_line_id: string;
  tds_deduction_id: string | null;
  status: TdsMatchStatus;
  score: number;
  reasons: string[];
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
  deduction: TdsDeductionRef | null;
};

export type TdsLine = {
  id: string;
  line_ref: string;
  deductor_tan: string;
  deductor_name: string;
  section: string;
  transaction_date: string;
  amount_paid: string;
  tds_deducted: string;
  tds_deposited: string | null;
  booking_status: string | null;
  client_id: string | null;
  client_name: string | null;
  match: TdsMatch | null;
};

export type TdsRunDetail = { run: TdsRun; lines: TdsLine[]; errors: { line_no: number; message: string }[] };

export type TdsCandidate = TdsDeductionRef & { score: number };

export type TdsExceptions = {
  deducted_not_recorded: TdsLine[];
  recorded_not_deposited: (TdsDeductionRef & { reason: "no_statement_line" | "booking_unmatched" })[];
};

export type TdsStatusValue = "reconciled" | "partially_reconciled" | "exceptions" | "not_started";

export type TdsStatusRow = {
  client_id: string;
  client_name: string | null;
  quarter: Quarter;
  status: TdsStatusValue;
  recorded_count: number;
  recorded_amount: string;
  matched_count: number;
  matched_amount: string;
  statement_count: number;
  statement_amount: string;
};

export type DeductorTan = { id: string; client_id: string; client_name: string | null; tan: string; created_at: string };

export type RunUpload = {
  legal_entity_id: string;
  fy: string;
  quarter: Quarter;
  statement_kind: StatementKind;
  file: File | null;
};
