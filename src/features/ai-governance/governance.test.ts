import { describe, expect, it } from "vitest";
import {
  activeConsoleTab,
  commentsPerDay,
  budgetIntent,
  COPILOT_PRIVATE_TEXT,
  copilotPrivacy,
  dailyCostSeries,
  EMPTY_RUN_FILTERS,
  formatMicrosUsd,
  formatUsd,
  KILL_SWITCH_TEXT,
  killSwitchView,
  reasonError,
  runsQuery,
  shouldPollRun,
  VIOLATION_TABS,
  violationKind,
} from "./logic";

describe("kill switch", () => {
  it("requires a reason of at least 10 characters", () => {
    expect(reasonError("")).toBe("Enter a reason.");
    expect(reasonError("too short")).toBe("Enter at least 10 characters.");
    expect(reasonError("   padded   ")).toBe("Enter at least 10 characters.");
    expect(reasonError("Incident #42 in progress")).toBeNull();
  });

  it("shows the banner when on and locks the control when the platform paused agents", () => {
    expect(killSwitchView({ kill_switch: true, platform_kill_switch: false, global_kill_switch: false })).toEqual({
      checked: true,
      disabled: false,
      banner: KILL_SWITCH_TEXT.onBanner,
    });
    expect(killSwitchView({ kill_switch: false, platform_kill_switch: true, global_kill_switch: false })).toEqual({
      checked: true,
      disabled: true,
      banner: "Paused by the platform operator",
    });
    expect(killSwitchView({ kill_switch: false, platform_kill_switch: false, global_kill_switch: false }).banner).toBeNull();
    expect(KILL_SWITCH_TEXT.stopTitle).toBe("Stop all AI agents?");
  });
});

describe("Copilot privacy", () => {
  it("disables the payload button and hides arguments for Copilot runs", () => {
    const p = copilotPrivacy({ origin: "copilot", copilot_private: true, payload_available: false });
    expect(p).toEqual({ payloadDisabled: true, hideArgs: true, note: COPILOT_PRIVATE_TEXT });
    expect(COPILOT_PRIVATE_TEXT).toBe("Copilot conversations are private to their user.");
  });

  it("treats a copilot origin as private even without the flag", () => {
    expect(copilotPrivacy({ origin: "copilot" }).hideArgs).toBe(true);
  });

  it("allows payloads of agent runs", () => {
    expect(copilotPrivacy({ origin: "agent", copilot_private: false, payload_available: true })).toEqual({
      payloadDisabled: false,
      hideArgs: false,
      note: null,
    });
  });
});

describe("violation tabs", () => {
  it("maps tabs to API kinds in order", () => {
    expect(VIOLATION_TABS.map((t) => [t.value, t.label])).toEqual([
      ["refused_tool", "Refused tools"],
      ["injection_detected", "Injection detections"],
      ["possible_cross_scope", "Possible cross-scope attempts"],
    ]);
    expect(violationKind("possible_cross_scope")).toBe("possible_cross_scope");
    expect(violationKind("bogus")).toBe("refused_tool");
  });
});

describe("cost formatting", () => {
  it("formats decimal-string USD with 2 decimals and grouping", () => {
    expect(formatUsd("0.0123")).toBe("$0.01");
    expect(formatUsd("1234.567")).toBe("$1,234.57");
    expect(formatUsd("999.995")).toBe("$1,000.00");
    expect(formatUsd("-2.5")).toBe("-$2.50");
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd("abc")).toBe("—");
  });

  it("formats micro-dollars", () => {
    expect(formatMicrosUsd(12_345)).toBe("$0.01");
    expect(formatMicrosUsd(1_500_000)).toBe("$1.50");
    expect(formatMicrosUsd(null)).toBe("—");
  });

  it("colours budget use: warning from 80 %, error at 100 %", () => {
    expect(budgetIntent(79)).toBe("brand");
    expect(budgetIntent(80)).toBe("warning");
    expect(budgetIntent(100)).toBe("error");
    expect(budgetIntent(null)).toBe("brand");
  });

  it("builds daily series rows with display text", () => {
    const { agents, rows } = dailyCostSeries([
      { day: "2026-10-02", agent_key: "sourcing", cost_usd: "1.2" },
      { day: "2026-10-01", agent_key: "sourcing", cost_usd: "0.5" },
      { day: "2026-10-01", agent_key: "screening", cost_usd: "2" },
    ]);
    expect(agents).toEqual(["sourcing", "screening"]);
    expect(rows.map((r) => r.day)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(rows[0].screening__display).toBe("$2.00");
  });
});

describe("runs console", () => {
  it("builds the runs query with multi-status and flags", () => {
    const q = new URLSearchParams(
      runsQuery({ ...EMPTY_RUN_FILTERS, statuses: ["running", "failed"], taintedOnly: true, agentKey: "sourcing" }, 2, 20),
    );
    expect(q.get("status")).toBe("running,failed");
    expect(q.get("tainted")).toBe("true");
    expect(q.get("agent_key")).toBe("sourcing");
    expect(q.get("page")).toBe("2");
    expect(q.has("with_violations")).toBe(false);
  });

  it("polls only while a run is moving", () => {
    expect(shouldPollRun("running")).toBe(true);
    expect(shouldPollRun("waiting")).toBe(true);
    expect(shouldPollRun("completed")).toBe(false);
  });

  it("selects the console tab of a path", () => {
    expect(activeConsoleTab("/admin/ai/runs/abc")).toBe("/admin/ai/runs");
    expect(activeConsoleTab("/admin/ai/costs")).toBe("/admin/ai/costs");
  });

  it("counts Copilot comments per day", () => {
    expect(commentsPerDay([{ created_at: "2026-10-01T10:00:00Z" }, { created_at: "2026-10-01T12:00:00Z" }])).toEqual({
      "2026-10-01": 2,
    });
  });
});
