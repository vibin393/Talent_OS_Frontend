import { describe, expect, it } from "vitest";
import type { PaymentSuggestionOut } from "./api";
import { GST_OUTPUT_ROWS, MATCH_NOTE_LABELS, prefillToPayment, recordStatusBadge, reconFlagLabels } from "./logic";

function suggestion(over: Partial<PaymentSuggestionOut> = {}): PaymentSuggestionOut {
  return {
    id: "s1",
    installation_id: "i1",
    legal_entity_id: "le1",
    external_ref: "ZP-1",
    invoice_id: "inv1",
    invoice_number: "INV-001",
    client_id: "c1",
    amount: "1000.00",
    currency: "INR",
    paid_on: "2026-10-01",
    tds_amount: "100.00",
    mode: "neft",
    reference: "UTR123",
    status: "pending",
    payment_id: null,
    decided_by: null,
    decided_at: null,
    reject_reason: null,
    match_note: null,
    created_at: "2026-10-01T00:00:00Z",
    client_name: "Acme",
    prefill: null,
    ...over,
  };
}

describe("ledger-sync logic", () => {
  it("maps record status to a badge including period-blocked", () => {
    expect(recordStatusBadge("synced")).toEqual({ label: "Synced", color: "success" });
    expect(recordStatusBadge("blocked_period")).toEqual({ label: "Blocked: period closed", color: "warning" });
    expect(recordStatusBadge("out_of_sync").label).toBe("Out of sync");
  });

  it("labels reconciliation flags", () => {
    expect(reconFlagLabels(["amount_differs", "only_in_ledger"])).toBe("Amount differs, Only in ledger");
  });

  it("labels match notes", () => {
    expect(MATCH_NOTE_LABELS.over_payment).toBe("More than the balance");
    expect(MATCH_NOTE_LABELS.invoice_not_found).toBe("Invoice not found");
  });

  it("builds the confirm PaymentIn from the suggestion, honouring edits", () => {
    const p = prefillToPayment(suggestion());
    expect(p.client_id).toBe("c1");
    expect(p.amount).toBe("1000.00");
    expect(p.currency).toBe("INR");
    expect(p.mode).toBe("neft");
    expect(p.allocations).toBe("auto");
    const edited = prefillToPayment(suggestion(), { amount: "900.00", reference: "UTR999" });
    expect(edited.amount).toBe("900.00");
    expect(edited.reference).toBe("UTR999");
  });

  it("prefers the server prefill when present", () => {
    const p = prefillToPayment(suggestion({ prefill: { amount: "750.00", mode: "upi", allocations: "none" } }));
    expect(p.amount).toBe("750.00");
    expect(p.mode).toBe("upi");
    expect(p.allocations).toBe("none");
  });

  it("has the twelve GST output rows", () => {
    expect(GST_OUTPUT_ROWS).toHaveLength(12);
    expect(GST_OUTPUT_ROWS[0]).toEqual({ key: "cgst:2.5", label: "CGST 2.5%" });
  });
});
