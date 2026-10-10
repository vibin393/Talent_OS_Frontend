import { describe, expect, it } from "vitest";
import { applyModes, approveDisabledReason, draftBadge, emptyRequest, segmentKey, shouldMarkOpened, summaryLine, toRequest, validateRequest } from "./logic";
import type { CopyDraftOut, CopySegment } from "./types";

function seg(i: number): CopySegment {
  return { key: `s${i}`, label: `Segment ${i}`, source: { kind: "attribute", field: "city", value: "Pune" } };
}

function draft(over: Partial<CopyDraftOut> = {}): CopyDraftOut {
  return {
    id: "d1", request_id: "r1", segment_key: "s1", segment_label: "Segment 1", variant_no: 1, channel: "email", subject: "Hi",
    preheader: null, body_html: "<p>Body</p>", template_values: null, job_link_blocks: [], status: "checked", findings: [],
    blocked: false, needs_ack: false, warnings_acknowledged: false, ai_generated: true, approved_by: null, approved_by_name: null,
    approved_at: null, rubber_stamp: false, edited_at: null, used_in_campaign_id: null, used_at: null, content_sha256: "x", ...over,
  };
}

describe("copy request validation", () => {
  it("limits segments to 20 and variants to 3", () => {
    const d = { ...emptyRequest("email"), segments: Array.from({ length: 21 }, (_, i) => seg(i)) };
    expect(validateRequest(d).segments).toBe("Use at most 20 segments.");
    expect(validateRequest({ ...d, segments: [seg(1)], variants: 4 }).variants).toBe("Choose 1 to 3 variants.");
    expect(validateRequest({ ...d, segments: [seg(1)], variants: 3 })).toEqual({});
  });
  it("requires a template for SMS and WhatsApp", () => {
    expect(validateRequest({ ...emptyRequest("sms"), segments: [seg(1)] }).template).toBe("Choose an approved template.");
    expect(validateRequest({ ...emptyRequest("whatsapp"), segments: [seg(1)], templateId: "t1" }).template).toBeUndefined();
  });
  it("builds the request body and unique segment keys", () => {
    const body = toRequest({ ...emptyRequest("email"), segments: [seg(1)], note: " New roles ", templateId: "t" }, { campaignId: "c1" });
    expect(body.brief.purpose_note).toBe("New roles");
    expect(body.channel_template_id).toBeNull();
    expect(segmentKey("Data engineers – Pune", ["data_engineers_pune"])).toBe("data_engineers_pune_2");
  });
});

describe("approve availability", () => {
  it("is disabled for blocking findings and unacknowledged warnings", () => {
    const block = draft({ findings: [{ code: "foreign_link", severity: "block", field: "body_html", excerpt: "x" }] });
    expect(approveDisabledReason(block, true)).toBe("Fix the issues marked Must fix");
    expect(approveDisabledReason(draft({ needs_ack: true }), true)).toBe("Acknowledge the checks first");
    expect(approveDisabledReason(draft(), true)).toBeNull();
    expect(approveDisabledReason(draft(), false)).not.toBeNull();
  });
  it("shows that an edit cleared the approval", () => {
    expect(draftBadge(draft({ status: "approved", approved_by_name: "Asha" }))).toBe("Approved by Asha");
    expect(draftBadge(draft({ status: "edited", edited_at: "2026-10-10T10:00:00Z" }))).toBe("Changed — needs approval");
  });
});

describe("apply modes", () => {
  it("A/B needs two approved variants of the same segment with the same body", () => {
    const a = draft({ id: "a", status: "approved" });
    const b = draft({ id: "b", status: "approved", variant_no: 2, subject: "Other" });
    expect(applyModes([a, b], "campaign").ab_subjects).toBe(true);
    expect(applyModes([a, { ...b, body_html: "<p>Different</p>" }], "campaign").ab_subjects).toBe(false);
    expect(applyModes([a, { ...b, segment_key: "s2" }], "campaign").ab_subjects).toBe(false);
    expect(applyModes([a, { ...b, status: "checked" }], "campaign").ab_subjects).toBe(false);
    expect(applyModes([a, b, draft({ id: "c", status: "approved" })], "campaign").ab_subjects).toBe(false);
    expect(applyModes([a], "campaign").single).toBe(true);
    expect(applyModes([a, { ...b, segment_key: "s2" }], "campaign").per_segment_campaigns).toBe(true);
    expect(applyModes([a], "sequence_step").per_segment_campaigns).toBe(false);
  });
  it("summarises the request", () => {
    expect(summaryLine({ segments: 4, variants: 8, blocked: 1 })).toBe("4 segments · 8 variants · 1 need changes");
  });
});

describe("opened tracking", () => {
  it("marks a segment opened only on its first tab selection", () => {
    const opened = new Set<string>();
    expect(shouldMarkOpened("s1", opened)).toBe(true);
    opened.add("s1");
    expect(shouldMarkOpened("s1", opened)).toBe(false);
    expect(shouldMarkOpened("s2", opened)).toBe(true);
  });
});
