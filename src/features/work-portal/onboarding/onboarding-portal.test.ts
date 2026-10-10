import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bankErrors } from "@/features/work-portal/validation";
import type { PortalTask } from "./api";
import {
  chipFor,
  createDebouncer,
  emergencySchema,
  looksLikeFullAadhaar,
  safeDraft,
  sortTasks,
  taxPayload,
  taxSchema,
  zodErrors,
} from "./logic";

const task = (over: Partial<PortalTask>): PortalTask => ({
  id: Math.random().toString(36).slice(2),
  kind: "personal_details",
  label: "Task",
  instructions: null,
  mandatory: true,
  status: "pending",
  due_on: null,
  return_comment: null,
  submitted_at: null,
  draft: null,
  masked: {},
  form: null,
  signature_request_id: null,
  signer_id: null,
  ...over,
});

describe("per-kind form validation", () => {
  it("bank: mismatch and IFSC", () => {
    const ok = { holder_name: "Asha", account_number: "123456789012", account_number_confirm: "123456789012", ifsc: "hdfc0001234" };
    expect(bankErrors(ok)).toEqual({});
    expect(bankErrors({ ...ok, account_number_confirm: "1" }).account_number_confirm).toMatch(/do not match/);
    expect(bankErrors({ ...ok, ifsc: "HDFC1234567" }).ifsc).toMatch(/IFSC/);
  });

  it("tax: PAN format and amounts", () => {
    expect(zodErrors(taxSchema, { pan: "abcpe1234f" })).toEqual({});
    expect(zodErrors(taxSchema, { pan: "ABC123" }).pan).toMatch(/PAN/);
    expect(zodErrors(taxSchema, { pan: "ABCPE1234F", section_80c: "12x" }).section_80c).toBeDefined();
    expect(taxPayload({ pan: "abcpe1234f", regime: "old", section_80c: "150000", section_80d: "" }, "form")).toEqual({
      pan: "ABCPE1234F",
      pan_name: undefined,
      regime: "old",
      declarations: { section_80c: "150000" },
    });
    expect(taxPayload({ pan: "ABCPE1234F", regime: "new" }, "upload")).toEqual({ pan: "ABCPE1234F", pan_name: undefined });
  });

  it("emergency contact needs a name and a phone", () => {
    expect(zodErrors(emergencySchema, { name: "", phone: "abc" })).toMatchObject({ name: expect.any(String), phone: expect.any(String) });
    expect(zodErrors(emergencySchema, { name: "Ravi", phone: "+91 98765 43210" })).toEqual({});
  });

  it("detects a full Aadhaar number and keeps it out of drafts", () => {
    expect(looksLikeFullAadhaar("1234 5678 9012")).toBe(true);
    expect(looksLikeFullAadhaar("9012")).toBe(false);
    expect(safeDraft({ holder_name: "A", account_number: "1", account_number_confirm: "1", pan: "X", aadhaar_number: "1" })).toEqual({
      holder_name: "A",
    });
  });
});

describe("status chips and ordering", () => {
  it("maps statuses to chips", () => {
    expect(chipFor("pending").label).toBe("To do");
    expect(chipFor("returned")).toEqual({ label: "Returned", color: "warning" });
    expect(chipFor("submitted").label).toBe("Submitted");
    expect(chipFor("approved").color).toBe("success");
  });

  it("puts returned tasks first and done tasks last", () => {
    const order = sortTasks([task({ status: "approved" }), task({ status: "pending" }), task({ status: "returned" }), task({ status: "submitted" })]);
    expect(order.map((t) => t.status)).toEqual(["returned", "pending", "submitted", "approved"]);
  });

  it("the portal task type has no internal-only fields", () => {
    const keys = Object.keys(task({}));
    for (const k of ["owner_user_id", "decided_by_id", "assignee", "source", "template_snapshot", "data"]) expect(keys).not.toContain(k);
  });
});

describe("autosave debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves only the last value after the quiet period", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const d = createDebouncer(save, 1000);
    d.push({ a: 1 });
    d.push({ a: 2 });
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ a: 2 });
  });

  it("keeps the value after a failed save and retries on flush", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const d = createDebouncer(save, 500);
    d.push({ a: 1 });
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(await d.flush()).toBe(true);
    expect(save).toHaveBeenLastCalledWith({ a: 1 });
  });

  it("cancel drops a pending save", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const d = createDebouncer(save, 300);
    d.push({ a: 1 });
    d.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });
});
