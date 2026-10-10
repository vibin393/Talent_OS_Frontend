import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { ApiError } from "@/lib/api/errors";
import { attributionPayload, readAttributionToken, withAttribution } from "./attribution";
import {
  abSampleError,
  approvalRequired,
  campaignErrorMessage,
  campaignTimeline,
  canCancel,
  canPause,
  canResume,
  clampFrequencyCap,
  formatRate,
  funnelBars,
  insertAt,
  sendWindowError,
  settingsToForm,
  validateSettings,
  validateWizard,
  type WizardDraft,
  wizardToCreate,
} from "./logic";
import { marketingSection } from "./marketing-tabs";
import type { CampaignOut, FunnelCounts, MarketingSettingsOut } from "./types";
import { UnsubscribeCard } from "./unsubscribe-page";
import { unsubscribeCopy, unsubscribeErrorCopy } from "./unsubscribe-logic";

function render(el: ReactElement): string {
  return renderToStaticMarkup(createElement(FluentProvider, { theme: webLightTheme }, el));
}

const SETTINGS: MarketingSettingsOut = {
  frequency_cap_count: 3,
  frequency_cap_days: 7,
  send_windows: { email: { start: "08:00", end: "21:00" }, sms: { start: "09:00", end: "21:00" }, whatsapp: { start: "09:00", end: "21:00" } },
  approval_threshold: 1000,
  ab_window_hours: 4,
  rate_per_minute: { email: 600, sms: 300, whatsapp: 300 },
  daily_cap: { email: 20000, sms: 10000, whatsapp: 10000 },
  platform_max_rate: { email: 1000, sms: 500, whatsapp: 500 },
  platform_max_daily: { email: 50000, sms: 20000, whatsapp: 20000 },
  attribution_window_days: 30,
  default_timezone: "Asia/Kolkata",
  footer_contact: null,
  paused_at: null,
  paused_reason: null,
};

describe("send window validation", () => {
  it("accepts windows inside the defaults with start < end", () => {
    expect(sendWindowError("email", { start: "08:00", end: "21:00" })).toBeNull();
    expect(sendWindowError("sms", { start: "10:30", end: "18:00" })).toBeNull();
  });

  it("rejects widening the defaults", () => {
    expect(sendWindowError("email", { start: "07:59", end: "20:00" })).toMatch(/08:00–21:00/);
    expect(sendWindowError("sms", { start: "08:00", end: "20:00" })).toMatch(/09:00–21:00/);
    expect(sendWindowError("whatsapp", { start: "09:00", end: "21:30" })).toMatch(/within/);
  });

  it("requires start before end and well-formed times", () => {
    expect(sendWindowError("email", { start: "12:00", end: "12:00" })).toMatch(/before/);
    expect(sendWindowError("email", { start: "18:00", end: "09:00" })).toMatch(/before/);
    expect(sendWindowError("email", { start: "9am", end: "21:00" })).toMatch(/HH:MM/);
    expect(sendWindowError("email", { start: "25:00", end: "21:00" })).toMatch(/HH:MM/);
  });
});

describe("settings form", () => {
  it("clamps the frequency cap SpinButton to 1..3", () => {
    expect(clampFrequencyCap(0)).toBe(1);
    expect(clampFrequencyCap(-5)).toBe(1);
    expect(clampFrequencyCap(2)).toBe(2);
    expect(clampFrequencyCap(4)).toBe(3);
    expect(clampFrequencyCap(99)).toBe(3);
    expect(clampFrequencyCap(2.6)).toBe(3);
    expect(clampFrequencyCap(null)).toBe(3);
    expect(clampFrequencyCap(Number.NaN)).toBe(3);
  });

  it("is valid for the server defaults", () => {
    expect(validateSettings(settingsToForm(SETTINGS), SETTINGS)).toEqual({});
  });

  it("bounds rates and daily caps by the platform maximum", () => {
    const f = settingsToForm(SETTINGS);
    f.rate_per_minute.sms = 501;
    f.daily_cap.email = 0;
    f.frequency_cap_count = 4;
    f.send_windows.sms = { start: "08:00", end: "21:00" };
    const e = validateSettings(f, SETTINGS);
    expect(e["rate_per_minute.sms"]).toMatch(/500/);
    expect(e["daily_cap.email"]).toMatch(/1 or more/);
    expect(e.frequency_cap_count).toMatch(/1 to 3/);
    expect(e["send_windows.sms"]).toBeDefined();
  });
});

describe("campaign wizard", () => {
  const draft = (over: Partial<WizardDraft> = {}): WizardDraft => ({
    name: "Java nurture",
    audience_id: "a1",
    channel: "email",
    email_subject: "New roles",
    email_body_html: "<p>Hi {{candidate.first_name}}</p>",
    channel_template_id: null,
    job_links: [],
    ab_enabled: false,
    ab_subject_b: "",
    ab_sample_pct: 10,
    ab_metric: "open",
    ab_window_hours: 4,
    schedule: "now",
    scheduled_at: "",
    ...over,
  });

  it("caps the A/B sample at 20%", () => {
    expect(abSampleError(20)).toBeNull();
    expect(abSampleError(2)).toBeNull();
    expect(abSampleError(21)).toMatch(/at most 20/);
    expect(abSampleError(1)).toMatch(/at least 2/);
    expect(abSampleError(12.5)).toMatch(/whole/);
    const v = validateWizard(draft({ ab_enabled: true, ab_subject_b: "B", ab_sample_pct: 25 }));
    expect(v.content?.join(" ")).toMatch(/at most 20/);
  });

  it("requires registered templates for SMS and WhatsApp", () => {
    expect(validateWizard(draft({ channel: "sms" })).content).toEqual(["Choose a registered template."]);
    expect(validateWizard(draft({ channel: "whatsapp", channel_template_id: "t1" })).content).toBeUndefined();
  });

  it("validates schedule in the future", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(validateWizard(draft({ schedule: "later", scheduled_at: "" }), now).schedule).toBeDefined();
    expect(validateWizard(draft({ schedule: "later", scheduled_at: "2026-10-01T10:00" }), now).schedule).toBeDefined();
    expect(validateWizard(draft({ schedule: "later", scheduled_at: "2026-12-01T10:00" }), now).schedule).toBeUndefined();
  });

  it("builds the create payload with the A/B test only for email", () => {
    const body = wizardToCreate(draft({ ab_enabled: true, ab_subject_b: "Variant B", ab_sample_pct: 20 }));
    expect(body.ab_test).toEqual({
      variants: [
        { key: "A", subject: "New roles" },
        { key: "B", subject: "Variant B" },
      ],
      sample_pct: 20,
      metric: "open",
      window_hours: 4,
    });
    const sms = wizardToCreate(draft({ channel: "sms", channel_template_id: "t1", ab_enabled: true, ab_subject_b: "x" }));
    expect(sms).toMatchObject({ email_subject: null, email_body_html: null, channel_template_id: "t1", ab_test: null, job_links: [] });
  });

  it("flags approval at or above the threshold", () => {
    expect(approvalRequired(1000, 1000)).toBe(true);
    expect(approvalRequired(1500, 1000)).toBe(true);
    expect(approvalRequired(999, 1000)).toBe(false);
    expect(approvalRequired(null, 1000)).toBe(false);
  });

  it("inserts merge fields at the caret", () => {
    expect(insertAt("Hi !", "{{candidate.first_name}}", 3, 3)).toEqual({ value: "Hi {{candidate.first_name}}!", caret: 27 });
    expect(insertAt("abc", "X", null, null)).toEqual({ value: "abcX", caret: 4 });
    expect(insertAt("abcdef", "X", 1, 4)).toEqual({ value: "aXef", caret: 2 });
  });
});

describe("campaign status and funnel", () => {
  const campaign = (over: Partial<CampaignOut>): CampaignOut =>
    ({
      id: "c1",
      status: "draft",
      created_at: "2026-10-01T10:00:00Z",
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      cancelled_at: null,
      ...over,
    }) as CampaignOut;

  it("allows pause / resume / cancel by status", () => {
    expect(canPause(campaign({ status: "sending" }))).toBe(true);
    expect(canPause(campaign({ status: "paused" }))).toBe(false);
    expect(canResume(campaign({ status: "paused" }))).toBe(true);
    expect(canCancel(campaign({ status: "completed" }))).toBe(false);
    expect(canCancel(campaign({ status: "pending_approval" }))).toBe(true);
  });

  it("lists only the timestamps that are set", () => {
    expect(campaignTimeline(campaign({ started_at: "2026-10-02T10:00:00Z" })).map((t) => t.label)).toEqual(["Created", "Started"]);
  });

  it("scales funnel bars to the largest stage", () => {
    const counts: FunnelCounts = {
      audience: 200,
      suppressed: 20,
      sent: 180,
      delivered: 170,
      bounced: 10,
      opened: 50,
      clicked: 20,
      replied: 5,
      unsubscribed: 1,
      applied: 4,
      hired: 0,
    };
    const bars = funnelBars(counts, { delivery_rate: 0.944, open_rate: 0.294, click_rate: 0.118, reply_rate: 0.03, unsubscribe_rate: 0, apply_rate: 0.02, hire_rate: 0 });
    expect(bars[0]).toMatchObject({ key: "audience", pct: 100, rate: null });
    expect(bars.find((b) => b.key === "opened")).toMatchObject({ value: 50, pct: 25, rate: 0.294 });
    expect(bars.find((b) => b.key === "hired")?.pct).toBe(0);
    expect(formatRate(0.294)).toBe("29.4%");
    expect(formatRate(null)).toBe("—");
  });

  it("maps campaign API errors", () => {
    expect(campaignErrorMessage(new ApiError(409, "invalid_transition", "x"))).toMatch(/no longer/);
    expect(campaignErrorMessage(new ApiError(409, "template_not_registered", "x"))).toMatch(/registered/);
    expect(campaignErrorMessage(new Error("x"))).toBeNull();
  });

  it("resolves the marketing section tab from the path", () => {
    expect(marketingSection("/marketing")).toBe("/marketing");
    expect(marketingSection("/marketing/campaigns/new")).toBe("/marketing/campaigns");
    expect(marketingSection("/marketing/settings")).toBe("/marketing/settings");
  });
});

describe("career site attribution", () => {
  it("reads only well-formed tokens", () => {
    expect(readAttributionToken("?tos_ct=abc.DEF-123_xyz")).toBe("abc.DEF-123_xyz");
    expect(readAttributionToken("tos_ct=short")).toBeNull();
    expect(readAttributionToken("?tos_ct=<script>alert(1)</script>")).toBeNull();
    expect(readAttributionToken("?q=java")).toBeNull();
    expect(readAttributionToken(null)).toBeNull();
  });

  it("keeps the token on links and in the apply payload", () => {
    expect(withAttribution("/careers/acme/jobs/1/apply", "tok12345")).toBe("/careers/acme/jobs/1/apply?tos_ct=tok12345");
    expect(withAttribution("/a?x=1#top", "tok12345")).toBe("/a?x=1&tos_ct=tok12345#top");
    expect(withAttribution("/a", null)).toBe("/a");
    expect(attributionPayload("?tos_ct=tok12345")).toEqual({ attribution_token: "tok12345" });
    expect(attributionPayload("")).toEqual({});
  });
});

describe("unsubscribe page", () => {
  const view = { tenant_name: "Acme Staffing", channel: "email", already_unsubscribed: false };
  const noop = () => undefined;

  it("renders the tenant, channel copy, all-marketing checkbox and confirm button", () => {
    const html = render(createElement(UnsubscribeCard, { view, state: "form", all: false, onAllChange: noop, onConfirm: noop }));
    expect(html).toContain("Unsubscribe from Acme Staffing");
    expect(html).toContain("marketing emails");
    expect(html).toContain("Unsubscribe from all marketing");
    expect(html).toMatch(/type="checkbox"/);
    expect(html).toContain(">Unsubscribe</button>");
    expect(html).toMatch(/<h1[^>]*tabindex="-1"/);
  });

  it("renders the confirmation state", () => {
    const html = render(createElement(UnsubscribeCard, { view, state: "done", all: true, doneAll: true, onAllChange: noop, onConfirm: noop }));
    expect(html).toContain("You are unsubscribed");
    expect(html).toContain("any channel");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("<button");
  });

  it("shows the confirmation when already unsubscribed and channel-specific copy", () => {
    const html = render(
      createElement(UnsubscribeCard, { view: { ...view, channel: "sms", already_unsubscribed: true }, state: "form", all: false, onAllChange: noop, onConfirm: noop }),
    );
    expect(html).toContain("You are unsubscribed");
    expect(html).toContain("text messages");
    expect(unsubscribeCopy({ tenant_name: " ", channel: "whatsapp" }, false).title).toBe("Unsubscribe from this organization");
  });

  it("maps link errors", () => {
    expect(unsubscribeErrorCopy(404).title).toMatch(/not valid/);
    expect(unsubscribeErrorCopy(0).title).toMatch(/offline/);
    expect(unsubscribeErrorCopy(500).title).toMatch(/wrong/);
  });
});
