import { describe, expect, it } from "vitest";
import {
  dsrDueBadge,
  dsrSteps,
  erasureProgress,
  ERASURE_CONFIRM_WORD,
  formatCountdown,
  isConfirmed,
  isDsrOverdue,
  isErasureActive,
  RETENTION_CONFIRM_WORD,
} from "./format";

const NOW = new Date("2026-10-31T12:00:00Z");

describe("DSR overdue badge", () => {
  it("is red Overdue once past due and still open", () => {
    const dsr = { status: "in_progress" as const, due_at: "2026-10-30T00:00:00Z" };
    expect(isDsrOverdue(dsr, NOW)).toBe(true);
    expect(dsrDueBadge(dsr, NOW)).toEqual({ label: "Overdue", color: "danger" });
  });
  it("trusts the server overdue flag", () => {
    expect(dsrDueBadge({ status: "received", due_at: "2027-01-01T00:00:00Z", overdue: true }, NOW)?.label).toBe("Overdue");
  });
  it("warns within 7 days and stays quiet before", () => {
    expect(dsrDueBadge({ status: "received", due_at: "2026-11-05T12:00:00Z" }, NOW)).toEqual({
      label: "Due in 5 days",
      color: "warning",
    });
    expect(dsrDueBadge({ status: "received", due_at: "2026-11-20T00:00:00Z" }, NOW)).toBeNull();
  });
  it("never badges closed requests", () => {
    expect(dsrDueBadge({ status: "completed", due_at: "2026-10-01T00:00:00Z", overdue: true }, NOW)).toBeNull();
    expect(isDsrOverdue({ status: "refused", due_at: "2026-10-01T00:00:00Z" }, NOW)).toBe(false);
  });
});

describe("DSR steps", () => {
  it("marks progress", () => {
    expect(dsrSteps("in_progress").map((s) => s.state)).toEqual(["done", "current", "todo"]);
    expect(dsrSteps("completed").map((s) => s.state)).toEqual(["done", "done", "done"]);
    expect(dsrSteps("refused").map((s) => s.key)).toEqual(["received", "refused"]);
  });
});

describe("typed confirmation guard", () => {
  it("requires the exact retention word", () => {
    expect(isConfirmed("ANONYMIZE", RETENTION_CONFIRM_WORD)).toBe(true);
    expect(isConfirmed("  ANONYMIZE ", RETENTION_CONFIRM_WORD)).toBe(true);
    expect(isConfirmed("anonymize", RETENTION_CONFIRM_WORD)).toBe(false);
    expect(isConfirmed("ANONYMIS", RETENTION_CONFIRM_WORD)).toBe(false);
    expect(isConfirmed("", RETENTION_CONFIRM_WORD)).toBe(false);
  });
  it("requires ERASE for erasure", () => {
    expect(isConfirmed("ERASE", ERASURE_CONFIRM_WORD)).toBe(true);
    expect(isConfirmed("DELETE", ERASURE_CONFIRM_WORD)).toBe(false);
  });
});

describe("erasure progress", () => {
  it("maps handler results", () => {
    const rows = erasureProgress({
      handler_results: {
        "candidates.profile": { status: "ok", counts: { candidates: 1, skills: 3 } },
        "files.candidate": { status: "failed", error: "OSError" },
        "search.index": { status: "ok", counts: {} },
      },
    });
    expect(rows).toEqual([
      { name: "candidates.profile", status: "ok", detail: "candidates: 1, skills: 3" },
      { name: "files.candidate", status: "failed", detail: "Failed (OSError)" },
      { name: "search.index", status: "ok", detail: "Nothing to erase" },
    ]);
    expect(isErasureActive({ status: "running" })).toBe(true);
    expect(isErasureActive({ status: "completed" })).toBe(false);
  });
});

describe("support banner countdown", () => {
  it("formats hh:mm and clamps at zero", () => {
    expect(formatCountdown("2026-10-31T14:05:30Z", NOW)).toBe("02:05");
    expect(formatCountdown("2026-10-31T11:00:00Z", NOW)).toBe("00:00");
    expect(formatCountdown("2026-11-01T13:00:00Z", NOW)).toBe("1 day 01:00");
    expect(formatCountdown(null, NOW)).toBe("—");
  });
});
