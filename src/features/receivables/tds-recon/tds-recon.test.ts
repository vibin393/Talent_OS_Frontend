import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { tdsReconApi } from "./api";
import {
  canConfirm,
  canReject,
  currentFy,
  currentQuarter,
  GENERIC_TDS_ERROR,
  isOpenLine,
  isValidFy,
  isValidTan,
  statusMatrix,
  tdsErrorMessage,
} from "./logic";
import type { TdsLine, TdsMatch, TdsStatusRow } from "./types";

const match = (over: Partial<TdsMatch> = {}): TdsMatch => ({
  id: "m1",
  statement_line_id: "l1",
  tds_deduction_id: "d1",
  status: "proposed",
  score: 90,
  reasons: ["TAN mapped", "amount equal"],
  decided_by: null,
  decided_at: null,
  note: null,
  deduction: null,
  ...over,
});

const line = (id: string, m: TdsMatch | null): TdsLine => ({
  id,
  line_ref: id,
  deductor_tan: "ABCD12345E",
  deductor_name: "Acme",
  section: "194J",
  transaction_date: "2026-07-01",
  amount_paid: "100000.00",
  tds_deducted: "10000.00",
  tds_deposited: "10000.00",
  booking_status: "F",
  client_id: "c1",
  client_name: "Acme",
  match: m,
});

describe("confirm requires one explicit selection (no bulk / auto confirm)", () => {
  it("allows exactly one selected line with a proposed match", () => {
    expect(canConfirm(line("a", match()))).toBe(true);
    expect(canConfirm([line("a", match())])).toBe(true);
  });

  it("refuses no selection, several lines, or non-proposed matches", () => {
    expect(canConfirm(null)).toBe(false);
    expect(canConfirm(undefined)).toBe(false);
    expect(canConfirm([])).toBe(false);
    expect(canConfirm([line("a", match()), line("b", match({ id: "m2" }))])).toBe(false);
    expect(canConfirm(line("a", null))).toBe(false);
    expect(canConfirm(line("a", match({ status: "confirmed" })))).toBe(false);
    expect(canConfirm(line("a", match({ status: "rejected" })))).toBe(false);
    expect(canConfirm(line("a", match({ status: "unmatched_ack" })))).toBe(false);
    expect(canConfirm(line("a", match({ tds_deduction_id: null })))).toBe(false);
  });

  it("exposes only a single-match confirm endpoint", () => {
    const keys = Object.keys(tdsReconApi);
    expect(keys).toContain("confirm");
    expect(keys.filter((k) => /confirm/i.test(k))).toEqual(["confirm"]);
    expect(tdsReconApi.confirm.length).toBe(1);
  });

  it("reject / open-line guards", () => {
    expect(canReject(line("a", match()))).toBe(true);
    expect(canReject(line("a", match({ status: "confirmed" })))).toBe(false);
    expect(isOpenLine(line("a", null))).toBe(true);
    expect(isOpenLine(line("a", match({ status: "rejected" })))).toBe(true);
    expect(isOpenLine(line("a", match({ status: "confirmed" })))).toBe(false);
    expect(isOpenLine(line("a", match({ status: "unmatched_ack" })))).toBe(false);
  });
});

describe("TAN, FY and quarter helpers", () => {
  it("validates TAN format", () => {
    expect(isValidTan("ABCD12345E")).toBe(true);
    expect(isValidTan(" abcd12345e ")).toBe(true);
    expect(isValidTan("ABC123456E")).toBe(false);
    expect(isValidTan("ABCD1234E")).toBe(false);
    expect(isValidTan("ABCD123456")).toBe(false);
  });

  it("validates and derives the Indian FY / quarter", () => {
    expect(isValidFy("2026-27")).toBe(true);
    expect(isValidFy("1999-00")).toBe(true);
    expect(isValidFy("2026-28")).toBe(false);
    expect(isValidFy("2026/27")).toBe(false);
    expect(currentFy(new Date(2026, 9, 6))).toBe("2026-27");
    expect(currentFy(new Date(2027, 1, 1))).toBe("2026-27");
    expect(currentQuarter(new Date(2026, 3, 1))).toBe("Q1");
    expect(currentQuarter(new Date(2026, 9, 6))).toBe("Q3");
    expect(currentQuarter(new Date(2027, 2, 31))).toBe("Q4");
  });
});

describe("status matrix", () => {
  it("groups by client with every quarter present, sorted by name", () => {
    const row = (client: string, name: string, quarter: TdsStatusRow["quarter"], status: TdsStatusRow["status"]): TdsStatusRow => ({
      client_id: client,
      client_name: name,
      quarter,
      status,
      recorded_count: 1,
      recorded_amount: "1",
      matched_count: 1,
      matched_amount: "1",
      statement_count: 1,
      statement_amount: "1",
    });
    const m = statusMatrix([row("c2", "Zeta", "Q1", "reconciled"), row("c1", "Alpha", "Q3", "exceptions"), row("c2", "Zeta", "Q2", "not_started")]);
    expect(m.map((r) => r.client_name)).toEqual(["Alpha", "Zeta"]);
    expect(m[0].cells.Q3?.status).toBe("exceptions");
    expect(m[0].cells.Q1).toBeNull();
    expect(m[1].cells.Q1?.status).toBe("reconciled");
    expect(m[1].cells.Q2?.status).toBe("not_started");
  });
});

describe("TDS upload error messages", () => {
  it("maps statement errors to friendly text", () => {
    expect(tdsErrorMessage(new ApiError(422, "tds_statement_pan_mismatch", "raw"))).toMatch(/different PAN/);
    expect(tdsErrorMessage(new ApiError(422, "tds_statement_unreadable", "raw"))).toMatch(/could not be read/);
    expect(tdsErrorMessage("legal_entity_pan_missing")).toMatch(/PAN/);
    expect(tdsErrorMessage(new ApiError(403, "human_only_action", "raw"))).toMatch(/person/);
  });

  it("falls back to generic text for unknown codes", () => {
    expect(tdsErrorMessage("whatever")).toBe(GENERIC_TDS_ERROR);
    expect(tdsErrorMessage(new ApiError(500, "internal_error", "trace"))).toBe(GENERIC_TDS_ERROR);
    expect(tdsErrorMessage(new Error("x"))).toBe(GENERIC_TDS_ERROR);
  });
});
