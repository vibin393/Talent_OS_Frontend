import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { ChecklistItem } from "@/lib/api/governance-types";
import {
  agentErrorText,
  agentStatus,
  BURN_IN_TOOLTIP,
  budgetErrors,
  type ConfigDraft,
  configChanges,
  enableDecision,
  expiryError,
  HIGH_RISK_TOOLTIP,
  modeOptions,
  overrideReasonError,
  readinessText,
} from "./logic";

describe("autonomy modes", () => {
  it("never offers Auto for high-risk actions", () => {
    expect(modeOptions("high", false).map((o) => o.value)).toEqual(["off", "suggest"]);
    expect(modeOptions("high", true).map((o) => o.value)).toEqual(["off", "suggest"]);
  });

  it("disables Auto during burn-in with the tooltip", () => {
    expect(modeOptions("low", true).find((o) => o.value === "auto")).toEqual({
      value: "auto",
      label: "Auto",
      disabled: true,
      tooltip: BURN_IN_TOOLTIP,
    });
    expect(modeOptions("low", false).find((o) => o.value === "auto")?.disabled).toBe(false);
  });
});

describe("422 mapping", () => {
  it("maps server codes to text", () => {
    expect(agentErrorText(new ApiError(422, "autonomy_not_allowed", "x"))).toBe(HIGH_RISK_TOOLTIP);
    expect(agentErrorText(new ApiError(422, "burn_in_active", "x"))).toBe(BURN_IN_TOOLTIP);
    expect(agentErrorText(new ApiError(422, "limit_above_ceiling", "x"))).toBe("Above the platform limit");
    expect(agentErrorText(new ApiError(422, "budget_above_tenant", "x"))).toBe("Above the tenant budget");
    expect(agentErrorText(new ApiError(422, "unknown_role", "x"))).toMatch(/role/);
    expect(agentErrorText(new ApiError(422, "tool_not_allowlisted", "x"))).toMatch(/not available/);
  });
});

describe("checklist blocking dialog", () => {
  const item = (key: string, status: ChecklistItem["status"], blocking: boolean): ChecklistItem => ({
    key,
    label: key,
    status,
    detail: "",
    fix_link: null,
    blocking,
  });

  it("opens the prerequisites dialog only for missing blocking items", () => {
    const items = [item("notice", "missing", true), item("aedt", "warning", false), item("ok", "ready", true)];
    expect(enableDecision(items)).toEqual({ kind: "confirm", missing: [items[0]] });
    expect(enableDecision([item("aedt", "warning", false)])).toEqual({ kind: "enable" });
    expect(readinessText(items)).toBe("1/3 ready");
  });

  it("needs Enable anyway and a 10-character reason", () => {
    expect(overrideReasonError(false, "a long enough reason")).not.toBeNull();
    expect(overrideReasonError(true, "short")).toBe("Enter at least 10 characters.");
    expect(overrideReasonError(true, "Pilot with one recruiter")).toBeNull();
  });
});

describe("budget validation", () => {
  it("flags values above the platform limit and the tenant budget", () => {
    const e = budgetErrors(
      { monthly_token_budget: 2_000_000, limits: { max_steps: 50, max_tool_calls: 10 } },
      { max_steps: 20, max_tool_calls: 30 },
      1_000_000,
    );
    expect(e).toEqual({ monthly_token_budget: "Above the tenant budget", max_steps: "Above the platform limit" });
    expect(budgetErrors({ monthly_token_budget: null, limits: {} }, {}, 10)).toEqual({});
    expect(expiryError(0)).not.toBeNull();
    expect(expiryError(720)).toBeNull();
  });

  it("sends only changed fields and actions", () => {
    const base: ConfigDraft = {
      default_mode: "suggest",
      monthly_token_budget: null,
      limits: { max_steps: 10 },
      triggers_enabled: { t: true },
      channels: ["email"],
      working_hours: null,
      proposal_expiry_hours: 72,
      actions: { a: { mode: "suggest", route_role_key: null } },
    };
    const draft: ConfigDraft = { ...base, proposal_expiry_hours: 24, actions: { a: { mode: "auto", route_role_key: null } } };
    expect(configChanges(base, draft)).toEqual({
      patch: { proposal_expiry_hours: 24 },
      actions: [{ tool_key: "a", mode: "auto", route_role_key: null }],
    });
  });
});

describe("agent status badge", () => {
  it("shows burn-in, on, off and not available", () => {
    const now = Date.parse("2026-10-09T00:00:00Z");
    expect(agentStatus({ placeholder: true, enabled: false, burn_in_until: null }, now).label).toBe("Not available yet");
    expect(agentStatus({ placeholder: false, enabled: false, burn_in_until: null }, now).label).toBe("Off");
    expect(agentStatus({ placeholder: false, enabled: true, burn_in_until: "2026-10-20T00:00:00Z" }, now).label).toMatch(/^On · suggest-only until /);
    expect(agentStatus({ placeholder: false, enabled: true, burn_in_until: "2026-10-01T00:00:00Z" }, now).label).toBe("On");
  });
});
