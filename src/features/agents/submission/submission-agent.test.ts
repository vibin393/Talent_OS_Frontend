import { describe, expect, it } from "vitest";
import { renderProposal } from "@/features/agent-proposals/proposal-renderers";
import {
  changedFieldsText,
  checkLabel,
  countWords,
  marginText,
  money,
  orderedChecks,
  packBadge,
  prefillFromPack,
  prefillNotice,
  prepareMode,
  resumeLine,
  rulesBody,
  rulesErrors,
  type RulesForm,
  usedLine,
  wordCounter,
} from "./logic";
import type { PackCheckDetail, PackDetailOut } from "./types";

function check(key: PackCheckDetail["key"], level: PackCheckDetail["level"], details: Record<string, unknown> = {}): PackCheckDetail {
  return { key, level, code: level, message: `${key} ${level}`, details, link: null };
}

function pack(over: Partial<PackDetailOut> = {}): PackDetailOut {
  return {
    id: "p1", human_id: "PCK-000001", application_id: "a1", candidate_id: "c1", candidate_name: "Priya Raman", demand_id: "d1",
    demand_title: "Senior Data Engineer", client_id: "cl1", client_name: "Acme", status: "draft", lifecycle: "open", version: 1,
    resume_kind: "client_formatted", resume_id: "r1", resume_version: 2, resume_uploaded_at: "2026-10-01T10:00:00Z", resume_stale: false,
    document_ids: ["f1"], summary_text: "Priya builds pipelines.", write_up_status: "drafted", word_count: 3, max_words: 150,
    pay_rate: "1000.00", bill_rate: "1500.00", currency: "INR", pay_rate_unit: "hour", bill_rate_unit: "hour", rates_hidden: false,
    email_subject: "Candidate submission for Senior Data Engineer", checks: [check("margin", "pass", { margin_pct: "21.33" })],
    missing: [], blocker_count: 0, warning_count: 0, checked_at: null, consent_request_sent_at: null, prepared_by_kind: "agent",
    prepared_by_id: null, agent_run_id: "run1", opened_in_dialog_at: null, submission_id: null, submission_human_id: null, used_at: null,
    user_changes: null, discarded_reason: null, lock_version: 1, created_at: "2026-10-08T10:00:00Z", updated_at: "2026-10-08T10:00:00Z",
    ...over,
  };
}

describe("panel states", () => {
  it("labels status and lifecycle", () => {
    expect(packBadge(pack()).label).toBe("Draft");
    expect(packBadge(pack({ status: "ready" })).label).toBe("Ready to review");
    expect(packBadge(pack({ status: "blocked" })).label).toBe("Blocked");
    expect(packBadge(pack({ lifecycle: "used" })).label).toBe("Sent");
    expect(packBadge(pack({ lifecycle: "discarded" })).label).toBe("Discarded");
    expect(packBadge(pack({ resume_stale: true })).label).toBe("Out of date");
  });
  it("names the checks in the spec's order and words", () => {
    expect(checkLabel("consent", "Acme")).toBe("Candidate consent for Acme");
    const keys = orderedChecks([check("resume_format", "pass"), check("consent", "warn"), check("duplicate", "block")]).map((c) => c.key);
    expect(keys).toEqual(["consent", "duplicate", "resume_format"]);
  });
  it("describes the resume and word counter", () => {
    expect(resumeLine(pack())).toBe("Client-formatted PDF (no contact details)");
    expect(resumeLine(pack({ resume_kind: "original" }))).toMatch(/^Original resume — version 2, uploaded /);
    expect(wordCounter(12, 150)).toBe("12 / 150 words");
    expect(countWords("  one two\nthree ")).toBe(3);
  });
  it("shows the used line with the changed fields", () => {
    const line = usedLine(pack({ lifecycle: "used", submission_human_id: "SUB-000123", used_at: "2026-10-09T10:00:00Z", user_changes: { changed_fields: ["bill_rate", "note"], note_change: "edited", before: {}, after: {} } }));
    expect(line).toMatch(/^Sent as SUB-000123 on .*\. You changed: bill rate, note to the client\.$/);
    expect(changedFieldsText([])).toBe("nothing");
  });
  it("chooses the prepare button by agent state", () => {
    expect(prepareMode({ enabled: true, paused: false })).toBe("agent");
    expect(prepareMode({ enabled: false, paused: false })).toBe("manual");
    expect(prepareMode({ enabled: false, paused: true })).toBe("paused");
    expect(prepareMode(undefined)).toBe("manual");
  });
});

describe("masking", () => {
  it("hides rates and margin without compensation:view", () => {
    expect(money("1000.00", "INR", "hour", true)).toBe("Hidden");
    expect(money("1000.00", "INR", "hour", false)).toBe("INR 1000.00 per hour");
    expect(marginText(pack({ rates_hidden: true }))).toBe("Hidden");
    expect(marginText(pack())).toBe("21.33%");
    expect(marginText(pack({ checks: [check("margin", "needs_input")] }))).toBe("Needs rates");
  });
});

describe("Submission dialog prefill", () => {
  it("maps resume, rates, units, currency, subject and note", () => {
    const p = prefillFromPack(pack({ resume_kind: "original" }));
    expect(p).toEqual({
      resumeKind: "original", payAmount: "1000.00", billAmount: "1500.00", currency: "INR", payUnit: "hour", billUnit: "hour",
      subject: "Candidate submission for Senior Data Engineer", note: "Priya builds pipelines.",
    });
    expect(prefillFromPack(pack({ rates_hidden: true })).payAmount).toBeNull();
    expect(prefillFromPack(pack({ resume_kind: null })).resumeKind).toBe("original");
    expect(prefillNotice("PCK-000001")).toBe(
      "Pre-filled from submission pack PCK-000001 prepared by the Submission Agent. Review everything before you submit.",
    );
  });
});

describe("client rules validation", () => {
  const base: RulesForm = {
    resume_format: "either", mask_contact_details: true, write_up_max_words: "150", write_up_instructions: "",
    duplicate_window_days: "", require_candidate_consent: false, show_notice_period: true,
  };
  it("accepts the defaults and builds the body", () => {
    expect(rulesErrors(base)).toEqual({});
    expect(rulesBody(base)).toMatchObject({ write_up_max_words: 150, duplicate_window_days: null, write_up_instructions: null });
  });
  it("rejects out-of-range values", () => {
    expect(rulesErrors({ ...base, write_up_max_words: "20" }).write_up_max_words).toBeTruthy();
    expect(rulesErrors({ ...base, duplicate_window_days: "900" }).duplicate_window_days).toBeTruthy();
    expect(rulesErrors({ ...base, write_up_instructions: "x".repeat(1001) }).write_up_instructions).toBeTruthy();
    expect(rulesBody({ ...base, duplicate_window_days: "30" }).duplicate_window_days).toBe(30);
  });
});

describe("proposal renderers", () => {
  it("renders the consent request and the write-up as plain text", () => {
    const consent = renderProposal({
      tool_key: "submissions.request_consent",
      title: "Send consent request to Priya Raman for Acme",
      preview: { title: "Send consent request to Priya Raman for Acme", summary: "A templated Secure Link e-mail.", fields: [["Candidate", "Priya Raman"]], renderer: null },
    } as never);
    expect(consent.title).toBe("Send consent request to Priya Raman for Acme");
    const write = renderProposal({
      tool_key: "submissions.save_write_up",
      title: "Save",
      preview: { title: "Save the submission write-up", summary: "Priya builds <b>pipelines</b>.", fields: [], renderer: "submissions.save_write_up" },
    } as never);
    expect(write.rows.at(-1)).toEqual({ label: "Write-up", value: "Priya builds <b>pipelines</b>." });
  });
});
