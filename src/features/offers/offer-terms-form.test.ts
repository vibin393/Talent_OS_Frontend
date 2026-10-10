import { describe, expect, it } from "vitest";
import { approvalRelevantChanged, changedFields, liveMargin, saveMode, type TermsValues, termsErrors, toUpdatePayload } from "./terms";

const base: TermsValues = {
  title: "Backend engineer",
  employment_type: "permanent",
  pay_amount: "1800.00",
  pay_currency: "INR",
  pay_rate_unit: "day",
  bill_amount: "2500.00",
  bill_currency: "INR",
  bill_rate_unit: "day",
  bonus_amount: "",
  bonus_currency: "INR",
  benefits_summary: "",
  start_date: "2026-11-01",
  end_date: "",
  location: "Pune",
  work_mode: "hybrid",
  expiry_date: "2026-10-10",
  template_id: "",
};
const opts = { today: "2026-10-01", masked: false };

describe("offer terms form", () => {
  it("accepts valid permanent terms", () => {
    expect(termsErrors(base, opts)).toEqual({});
  });

  it("requires an end date after the start for contracts", () => {
    expect(termsErrors({ ...base, employment_type: "contract" }, opts).end_date).toMatch(/end date/);
    expect(termsErrors({ ...base, employment_type: "contract_to_hire", end_date: "2026-10-15" }, opts).end_date).toMatch(/after the start/);
    expect(termsErrors({ ...base, employment_type: "contract", end_date: "2027-04-30" }, opts)).toEqual({});
  });

  it("flags a currency mismatch, bad amounts and a past expiry", () => {
    expect(termsErrors({ ...base, bill_currency: "USD" }, opts).bill_currency).toMatch(/currency must match/);
    expect(termsErrors({ ...base, bill_currency: "USD" }, { ...opts, masked: true }).bill_currency).toBeUndefined();
    expect(termsErrors({ ...base, pay_amount: "0" }, opts).pay_amount).toBeTruthy();
    expect(termsErrors({ ...base, pay_amount: "12,00" }, opts).pay_amount).toBeTruthy();
    expect(termsErrors({ ...base, expiry_date: "2026-09-30" }, opts).expiry_date).toMatch(/past/);
  });

  it("warns that approval-relevant edits on approved offers need re-approval", () => {
    expect(saveMode("draft", base, { ...base, pay_amount: "1900" })).toBe("edit");
    expect(saveMode("approved", base, { ...base, pay_amount: "1900" })).toBe("new_version_reapproval");
    expect(saveMode("released", base, { ...base, start_date: "2026-11-15" })).toBe("new_version_reapproval");
    expect(saveMode("viewed", base, { ...base, benefits_summary: "Health cover" })).toBe("new_version");
    expect(saveMode("pending_approval", base, base)).toBe("locked");
    expect(saveMode("accepted", base, base)).toBe("terminal");
    // Formatting-only amount edits are not changes.
    expect(approvalRelevantChanged(base, { ...base, pay_amount: "1800" })).toBe(false);
    expect(changedFields(base, { ...base, location: " Pune " })).toEqual([]);
  });

  it("computes the live margin with burden and unit conversion", () => {
    const m = liveMargin(base, 10, 15);
    expect(m).toMatchObject({ amount: 520, pct: 20.8, color: "success", belowMin: false });
    const low = liveMargin({ ...base, bill_amount: "2000" }, 10, 15);
    expect(low).toMatchObject({ amount: 20, pct: 1, color: "danger", belowMin: true });
    const warn = liveMargin({ ...base, bill_amount: "2400" }, 10, 15);
    expect(warn?.color).toBe("warning");
    // Monthly pay vs daily bill: 21,000/month = 1,000/day at 8h days (168h months).
    expect(liveMargin({ ...base, pay_amount: "21000", pay_rate_unit: "month", bill_amount: "1250" }, 0, null)).toMatchObject({ amount: 250, pct: 20 });
    expect(liveMargin({ ...base, bill_amount: "" }, 0, null)).toBeNull();
    expect(liveMargin({ ...base, bill_currency: "USD" }, 0, null)).toBeNull();
  });

  it("sends only changed fields, never bill rates when masked", () => {
    const next = { ...base, pay_amount: "1900", location: "Mumbai", bill_amount: "2600" };
    expect(toUpdatePayload(base, next, 4, false)).toEqual({
      lock_version: 4,
      pay_rate: { amount: "1900.00", currency: "INR" },
      bill_rate: { amount: "2600.00", currency: "INR" },
      location: "Mumbai",
    });
    expect(toUpdatePayload(base, next, 4, true).bill_rate).toBeUndefined();
  });
});
