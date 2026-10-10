import { describe, expect, it, vi } from "vitest";
import { channelActivityLabel, isChannelActivity } from "@/features/comms/channel-activity";
import { careersPath, decideHost, HostCache, resolveCustomHost, appHosts } from "./host-routing";
import {
  connectorErrors,
  connectorPayload,
  dnsRecords,
  domainStatusBadge,
  eligibilityBadge,
  eligibleCount,
  emptyTemplateDraft,
  formatAge,
  messageStatusBadge,
  normalizeHost,
  optOutCopy,
  optOutScreen,
  quietHoursErrors,
  replyPlainText,
  replyPreview,
  sendableTemplates,
  templatePayload,
  templateStatusBadge,
  toE164,
  validateTemplate,
} from "./logic";
import type { ChannelTemplate } from "./types";

describe("eligibility badges", () => {
  it("maps eligible and each refusal reason", () => {
    expect(eligibilityBadge({ eligible: true, reason: null })).toEqual({ label: "Ready", color: "success" });
    expect(eligibilityBadge({ eligible: false, reason: "no_phone" })).toEqual({ label: "No phone number", color: "warning" });
    expect(eligibilityBadge({ eligible: false, reason: "opted_out" })).toEqual({ label: "Opted out", color: "danger" });
    expect(eligibilityBadge({ eligible: false, reason: "no_whatsapp_consent" }).label).toBe("No WhatsApp opt-in");
    expect(eligibilityBadge({ eligible: false, reason: "missing_variable" }).color).toBe("warning");
    expect(eligibilityBadge(undefined).label).toBe("Checking…");
  });
  it("counts eligible rows", () => {
    expect(eligibleCount([{ eligible: true }, { eligible: false }, { eligible: true }])).toBe(2);
    expect(eligibleCount(undefined)).toBe(0);
  });
  it("labels message statuses with a fallback", () => {
    expect(messageStatusBadge("manual_pending").label).toBe("Awaiting manual send");
    expect(messageStatusBadge("weird")).toEqual({ label: "weird", color: "subtle" });
    expect(formatAge(42)).toBe("42 s");
    expect(formatAge(7200)).toBe("2 h");
  });
});

describe("template validation", () => {
  const base = { ...emptyTemplateDraft("sms"), name: "Reminder", key: "timesheet_reminder", body: "Hi {{ candidate.first_name }}" };
  it("accepts a valid draft", () => {
    expect(validateTemplate(base)).toEqual({});
  });
  it("requires a 19-digit DLT id", () => {
    expect(validateTemplate({ ...base, provider_template_ref: "12345" }).provider_template_ref).toMatch(/19 digits/);
    expect(validateTemplate({ ...base, provider_template_ref: "1234567890123456789" })).toEqual({});
    expect(validateTemplate({ ...base, provider_template_ref: "123456789012345678a" }).provider_template_ref).toBeTruthy();
    expect(validateTemplate({ ...base, status: "registered" }).provider_template_ref).toMatch(/DLT/);
  });
  it("limits SMS length and checks the sender id", () => {
    expect(validateTemplate({ ...base, body: "x".repeat(1001) }).body).toMatch(/1000/);
    expect(validateTemplate({ ...base, body: "x".repeat(1000) })).toEqual({});
    expect(validateTemplate({ ...base, sender_id: "TALN" }).sender_id).toBeTruthy();
    expect(validateTemplate({ ...base, sender_id: "TALNOS" })).toEqual({});
  });
  it("flags unknown merge fields when the catalogue is loaded", () => {
    expect(validateTemplate(base, ["candidate.first_name"])).toEqual({});
    expect(validateTemplate({ ...base, body: "Hi {{ foo.bar }}" }, ["candidate.first_name"]).body).toMatch(/foo\.bar/);
  });
  it("validates WhatsApp template names", () => {
    const wa = { ...base, channel: "whatsapp" as const };
    expect(validateTemplate({ ...wa, provider_template_ref: "Timesheet Reminder" }).provider_template_ref).toBeTruthy();
    expect(validateTemplate({ ...wa, provider_template_ref: "timesheet_reminder_v2", body: "x".repeat(1500) })).toEqual({});
  });
  it("derives variables and normalises refs in the payload", () => {
    const p = templatePayload({ ...base, body: "{{ a.b }} {{ c.d }} {{ a.b }}", sender_id: " talnos ", provider_template_ref: " " });
    expect(p.variables).toEqual(["a.b", "c.d"]);
    expect(p.sender_id).toBe("TALNOS");
    expect(p.provider_template_ref).toBeNull();
    expect(templatePayload({ ...base, channel: "whatsapp", sender_id: "TALNOS" }).sender_id).toBeNull();
  });
  it("offers only registered, sendable templates of the channel", () => {
    const t = (o: Partial<ChannelTemplate>) => ({ id: "1", channel: "sms", status: "registered", sendable: true, ...o }) as ChannelTemplate;
    const list = [t({ id: "a" }), t({ id: "b", sendable: false }), t({ id: "c", status: "draft" }), t({ id: "d", channel: "whatsapp" })];
    expect(sendableTemplates(list, "sms").map((x) => x.id)).toEqual(["a"]);
    expect(templateStatusBadge({ status: "registered", sendable: false }).color).toBe("warning");
  });
});

describe("opt-out link renderer", () => {
  it("chooses the screen from purpose and status", () => {
    expect(optOutScreen({ purpose: "channel_opt_out", status: "active" })).toBe("confirm");
    expect(optOutScreen({ purpose: "channel_opt_out", status: null })).toBe("confirm");
    expect(optOutScreen({ purpose: "channel_opt_out", status: "opted_out" })).toBe("done");
    expect(optOutScreen({ purpose: "channel_opt_out", status: "revoked" })).toBe("unsupported");
    expect(optOutScreen({ purpose: "client_feedback", status: "active" })).toBe("unsupported");
  });
  it("names the channel and tenant", () => {
    expect(optOutCopy("whatsapp", "Acme").title).toBe("Stop WhatsApp messages from Acme?");
    expect(optOutCopy("sms", null).action).toBe("Stop SMS messages");
  });
});

describe("custom domain", () => {
  const d = { host: "careers.example.in", txt_name: "_talentos.careers.example.in", txt_value: "tos-verify=abc", cname_target: "careers.talentos.app" };
  it("lists the TXT and CNAME records", () => {
    expect(dnsRecords(d)).toEqual([
      { type: "TXT", name: "_talentos.careers.example.in", value: "tos-verify=abc", purpose: expect.any(String) },
      { type: "CNAME", name: "careers.example.in", value: "careers.talentos.app", purpose: expect.any(String) },
    ]);
    expect(dnsRecords(null)).toEqual([]);
  });
  it("badges status and normalises hosts", () => {
    expect(domainStatusBadge("verified")).toEqual({ label: "Verified", color: "success" });
    expect(domainStatusBadge("pending").color).toBe("warning");
    expect(normalizeHost(" https://Careers.Example.in/jobs ")).toBe("careers.example.in");
    expect(normalizeHost("localhost")).toBeNull();
    expect(normalizeHost("bad host.com")).toBeNull();
  });
});

describe("proxy host routing", () => {
  const env = { NEXT_PUBLIC_APP_URL: "https://app.talentos.in", CAREERS_ROOT_DOMAIN: "jobs.talentos.in" };
  it("leaves app hosts and localhost untouched", () => {
    expect(decideHost("app.talentos.in", "/dashboard", env)).toEqual({ kind: "pass" });
    expect(decideHost("localhost:3000", "/", env)).toEqual({ kind: "pass" });
    expect(decideHost("127.0.0.1", "/", {})).toEqual({ kind: "pass" });
    expect(appHosts({ APP_HOST: "a.example.com, b.example.com" }).has("b.example.com")).toBe(true);
  });
  it("keeps subdomain mode", () => {
    expect(decideHost("acme.jobs.talentos.in", "/jobs/1", env)).toEqual({ kind: "subdomain", slug: "acme" });
    expect(decideHost("www.jobs.talentos.in", "/", env)).toEqual({ kind: "pass" });
    expect(decideHost("acme.jobs.talentos.in", "/_next/static/x.js", env)).toEqual({ kind: "pass" });
  });
  it("treats other hosts as custom domains", () => {
    expect(decideHost("Careers.Example.in:443", "/", env)).toEqual({ kind: "custom", host: "careers.example.in" });
    expect(decideHost("careers.example.in", "/portal/sign-in", env)).toEqual({ kind: "pass" });
    expect(decideHost("10.0.0.5", "/", env)).toEqual({ kind: "pass" });
  });
  it("builds the rewrite path", () => {
    expect(careersPath("acme", "/")).toBe("/careers/acme");
    expect(careersPath("acme", "/robots.txt")).toBe("/careers/acme/robots.txt");
  });
  it("resolves custom hosts through the API and caches for 5 minutes", async () => {
    const cache = new HostCache();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ slug: "acme" }), { status: 200 }));
    expect(await resolveCustomHost("careers.example.in", "http://api:8000/", cache, fetcher, 0)).toBe("acme");
    expect(fetcher).toHaveBeenCalledWith("http://api:8000/api/v1/public/careers/resolve-host?host=careers.example.in", expect.any(Object));
    expect(await resolveCustomHost("careers.example.in", "http://api:8000", cache, fetcher, 60_000)).toBe("acme");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await resolveCustomHost("careers.example.in", "http://api:8000", cache, fetcher, 5 * 60_000 + 1)).toBe("acme");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("caches misses but not failures", async () => {
    const cache = new HostCache();
    const miss = vi.fn(async () => new Response("{}", { status: 404 }));
    expect(await resolveCustomHost("x.example.com", "http://api", cache, miss, 0)).toBeNull();
    expect(await resolveCustomHost("x.example.com", "http://api", cache, miss, 1000)).toBeNull();
    expect(miss).toHaveBeenCalledTimes(1);
    const down = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await resolveCustomHost("y.example.com", "http://api", cache, down, 0)).toBeNull();
    expect(cache.get("y.example.com", 0)).toBeUndefined();
  });
});

describe("reply card text", () => {
  it("strips HTML and scripts so nothing is injected", () => {
    const out = replyPlainText('<p>Hello<br>there</p><script>alert(1)</script><img src=x onerror="alert(2)">&lt;b&gt;');
    // Decoded entities are shown literally (rendered as a text node), never as markup.
    expect(out).toBe("Hello\nthere\n<b>");
    expect(out).not.toMatch(/script|onerror|<img/);
  });
  it("decodes entities only after removing tags", () => {
    expect(replyPlainText("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(replyPlainText("")).toBe("");
    expect(replyPlainText(null)).toBe("");
  });
  it("truncates long replies for Show more", () => {
    const text = "word ".repeat(100).trim();
    const p = replyPreview(text, 50);
    expect(p.truncated).toBe(true);
    expect(p.text.length).toBeLessThanOrEqual(51);
    expect(replyPreview("short", 50)).toEqual({ text: "short", truncated: false });
  });
  it("labels the new activity kinds", () => {
    expect(isChannelActivity("email_reply")).toBe(true);
    expect(isChannelActivity("note")).toBe(false);
    expect(channelActivityLabel("whatsapp")).toBe("WhatsApp");
  });
});

describe("connectors and settings", () => {
  it("splits credentials from settings and keeps stored secrets", () => {
    expect(connectorPayload("meta_cloud", { access_token: "t", app_secret: "", phone_number_id: "1", waba_id: "2" })).toEqual({
      credentials: { access_token: "t" },
      settings: { phone_number_id: "1", waba_id: "2" },
    });
    expect(connectorPayload("fake", {})).toEqual({ credentials: undefined, settings: {} });
    expect(Object.keys(connectorErrors("msg91", {}, false))).toEqual(["auth_key"]);
    expect(connectorErrors("msg91", {}, true)).toEqual({});
  });
  it("validates quiet hours and phone numbers", () => {
    expect(quietHoursErrors({ start: "21:00", end: "09:00", tz: "Asia/Kolkata" })).toEqual({});
    expect(Object.keys(quietHoursErrors({ start: "25:00", end: "9", tz: "" }))).toEqual(["start", "end", "tz"]);
    expect(toE164("98765 43210")).toBe("+919876543210");
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(toE164("123")).toBeNull();
  });
});
