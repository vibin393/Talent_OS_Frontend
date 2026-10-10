import { describe, expect, it } from "vitest";
import { webLightTheme } from "@fluentui/react-components";
import { applyPrefill, consentPayload, EMPTY_DETAILS, expiryState, fileError, isValidPhone, validateConsent, validateDetails, applyErrorMessage } from "./apply/model";
import { siteDraft, siteUpdate, stageKeys, validateSite } from "./admin/site-form";
import { questionKey, toQuestions, validateQuestions, emptyQuestion } from "./admin/questions-form";
import { postingsQuery as postingsQueryString } from "@/lib/api/public-server";
import { jobPath, requestOrigin, searchHref, serializeJsonLd, textExcerpt } from "./format";
import { answersPayload, validateAnswers } from "./questions";
import { brandHasContrast, brandRampFromHex, careerThemes, contrastRatio, suggestAccessibleColor } from "./theme";
import type { CareerSiteOut, PublicApplyForm, PublicApplyQuestion } from "@/lib/api/types";

describe("theme", () => {
  it("builds a 16-shade ramp with the input at shade 80, dark to light", () => {
    const ramp = brandRampFromHex("#0F6CBD");
    expect(ramp).not.toBeNull();
    const keys = Object.keys(ramp!).map(Number);
    expect(keys).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]);
    expect(ramp![80]).toBe("#0F6CBD");
    for (const v of Object.values(ramp!)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
    // Luminance increases monotonically from shade 10 to shade 160.
    const lum = keys.map((k) => contrastRatio(ramp![k as 10], "#000000"));
    for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeGreaterThanOrEqual(lum[i - 1]);
  });

  it("rejects invalid colours", () => {
    expect(brandRampFromHex("blue")).toBeNull();
    expect(brandRampFromHex("#12345")).toBeNull();
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("falls back to the default Fluent theme when the brand colour fails 4.5:1 on white", () => {
    expect(brandHasContrast("#FFFF00")).toBe(false);
    const fallback = careerThemes("#FFFF00");
    expect(fallback.branded).toBe(false);
    expect(fallback.light).toBe(webLightTheme);
    expect(careerThemes(null).branded).toBe(false);
    const branded = careerThemes("#0F6CBD");
    expect(branded.branded).toBe(true);
    expect(branded.light.colorBrandBackground).toBe("#0F6CBD");
  });

  it("suggests a darker accessible shade", () => {
    const s = suggestAccessibleColor("#FFFF00")!;
    expect(contrastRatio(s, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(suggestAccessibleColor("#0F6CBD")).toBe("#0F6CBD");
  });
});

describe("JSON-LD and page helpers", () => {
  it("escapes characters that could close the script element", () => {
    const out = serializeJsonLd({ title: "</script><script>alert(1)</script> & more", x: "\u2028" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toContain("\\u003c/script\\u003e");
    expect(out).toContain("\\u0026");
    expect(out).toContain("\\u2028");
    expect(JSON.parse(out).title).toBe("</script><script>alert(1)</script> & more");
  });

  it("builds canonical paths and search links", () => {
    expect(jobPath("acme", "abc", "java-dev")).toBe("/careers/acme/jobs/abc/java-dev");
    expect(searchHref("acme", { q: "java", location: "", page: 1 })).toBe("/careers/acme?q=java");
    expect(searchHref("acme", { q: "", page: 3 })).toBe("/careers/acme?page=3");
    expect(postingsQueryString({ q: " java ", page: 0 })).toBe("q=java&page=1&page_size=20");
  });

  it("makes plain-text excerpts", () => {
    expect(textExcerpt("<p>Hello &amp; <b>welcome</b></p>")).toBe("Hello & welcome");
    expect(textExcerpt(`<p>${"a".repeat(300)}</p>`, 20)).toHaveLength(20);
  });

  it("derives the request origin", () => {
    expect(requestOrigin(new Headers({ host: "localhost:3000" }), "https://x")).toBe("http://localhost:3000");
    expect(requestOrigin(new Headers({ host: "jobs.example.com", "x-forwarded-proto": "https" }), "https://x")).toBe("https://jobs.example.com");
    expect(requestOrigin(new Headers({ host: "evil.com/<x>" }), "https://fallback")).toBe("https://fallback");
  });
});

const notice = (purpose: string) => ({ id: `${purpose}-id`, purpose, version: 1, title: purpose, body: "b", body_html: "<p>b</p>" });
const form = (over: Partial<PublicApplyForm> = {}): PublicApplyForm => ({
  posting_id: "p1",
  title: "Java developer",
  notices: [notice("data_processing"), notice("ai_processing"), notice("marketing")],
  apply_questions: [],
  max_upload_mb: 10,
  accepted_types: ["application/pdf"],
  challenge: { provider: "none", site_key: "" },
  requires_phone: false,
  ...over,
});

describe("apply flow: consent gating", () => {
  it("requires the data-processing consent before a session is created", () => {
    expect(validateConsent(form(), { data: false, ai: true }, null)).toHaveProperty("apply-consent-data");
    expect(validateConsent(form(), { data: true, ai: false }, null)).toEqual({});
  });

  it("requires the challenge token unless the provider is none", () => {
    const f = form({ challenge: { provider: "turnstile", site_key: "k" } });
    expect(validateConsent(f, { data: true, ai: false }, null)).toHaveProperty("apply-challenge");
    expect(validateConsent(f, { data: true, ai: false }, "tok")).toEqual({});
  });

  it("blocks applying when no data-processing notice is active", () => {
    const f = form({ notices: [notice("ai_processing")] });
    expect(validateConsent(f, { data: true, ai: true }, null)).toHaveProperty("apply-consent-data");
  });

  it("sends AI consent only when ticked", () => {
    expect(consentPayload(form(), { data: true, ai: false })).toEqual([{ purpose: "data_processing", notice_id: "data_processing-id" }]);
    expect(consentPayload(form(), { data: true, ai: true }).map((c) => c.purpose)).toEqual(["data_processing", "ai_processing"]);
  });
});

describe("apply flow: prefill and details", () => {
  it("fills only empty fields and reports which ones came from the resume", () => {
    const { details, filled } = applyPrefill(
      { ...EMPTY_DETAILS, email: "typed@example.com" },
      { full_name: "Asha Rao", email: "resume@example.com", phone: "+919876543210", location: null, links: ["https://github.com/asha"], skills: [] },
    );
    expect(details.email).toBe("typed@example.com");
    expect(details.full_name).toBe("Asha Rao");
    expect(details.links).toBe("https://github.com/asha");
    expect(filled.sort()).toEqual(["full_name", "links", "phone"]);
  });

  it("validates email, phone and links", () => {
    const errs = validateDetails({ full_name: "", email: "nope", phone: "12", location: "", links: "not a url" }, true);
    expect(Object.keys(errs).sort()).toEqual(["email", "full_name", "links", "phone"]);
    expect(validateDetails({ full_name: "A", email: "a@b.co", phone: "", location: "", links: "" }, false)).toEqual({});
    expect(validateDetails({ full_name: "A", email: "a@b.co", phone: "", location: "", links: "" }, true)).toHaveProperty("phone");
  });

  it("accepts E.164 and Indian mobile numbers", () => {
    expect(isValidPhone("+1 415 555 0100")).toBe(true);
    expect(isValidPhone("98765 43210")).toBe(true);
    expect(isValidPhone("+91-98765-43210")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });

  it("checks resume files", () => {
    expect(fileError({ name: "cv.pdf", size: 1000 }, 10)).toBeNull();
    expect(fileError({ name: "cv.exe", size: 1000 }, 10)).toMatch(/PDF/);
    expect(fileError({ name: "cv.docx", size: 11 * 1024 * 1024 }, 10)).toMatch(/10 MB/);
  });

  it("warns 5 minutes before the session expires", () => {
    const t = Date.parse("2026-01-01T10:00:00Z");
    expect(expiryState("2026-01-01T10:30:00Z", t)).toBe("ok");
    expect(expiryState("2026-01-01T10:04:00Z", t)).toBe("warning");
    expect(expiryState("2026-01-01T09:59:00Z", t)).toBe("expired");
    expect(expiryState(null, t)).toBe("none");
  });

  it("maps API errors to candidate-friendly copy", () => {
    expect(applyErrorMessage("rate_limited", 429, "x")).toBe("Too many attempts, try again later.");
    expect(applyErrorMessage("challenge_failed", 422, "x")).toMatch(/security check/);
    expect(applyErrorMessage("other", 400, "fallback")).toBe("fallback");
  });
});

describe("questions", () => {
  const qs: PublicApplyQuestion[] = [
    { key: "years", label: "Years", type: "number", required: true },
    { key: "remote", label: "Remote?", type: "boolean", required: false },
    { key: "stack", label: "Stack", type: "choice", options: ["Java", "Go"], required: false },
    { key: "pay", label: "Pay", type: "money", required: false },
  ];
  it("validates and converts answers", () => {
    expect(validateAnswers(qs, {})).toEqual({ years: "Answer this question" });
    expect(validateAnswers(qs, { years: "x", stack: "Rust" })).toHaveProperty("stack");
    expect(answersPayload(qs, { years: "5", remote: "yes", stack: "Go", pay: "100" })).toEqual({
      years: 5,
      remote: true,
      stack: "Go",
      pay: { amount: "100", currency: null },
    });
  });
});

describe("admin: career site form", () => {
  const site: CareerSiteOut = {
    slug: "acme",
    enabled: false,
    display_name: "Acme",
    brand_color: "#0F6CBD",
    about_md: "",
    about_html: null,
    privacy_contact_email: null,
    candidate_stage_labels: { applied: "Thanks!" },
    default_stage_labels: { withdrawn: "Withdrawn", applied: "Application received", hired: "Hired" },
    apply_requires_phone: false,
    logo_url: null,
    header_url: null,
    public_url: "http://localhost:3000/careers/acme",
    updated_at: null,
  };
  it("orders stages by the pipeline", () => {
    expect(stageKeys(site)).toEqual(["applied", "hired", "withdrawn"]);
  });
  it("sends only changed fields and drops blank labels", () => {
    const a = siteDraft(site);
    expect(siteUpdate(a, a)).toEqual({});
    const b = { ...a, brand_color: "#123456", labels: { applied: " ", hired: "Welcome aboard" } };
    expect(siteUpdate(a, b)).toEqual({ brand_color: "#123456", candidate_stage_labels: { hired: "Welcome aboard" } });
  });
  it("requires a privacy contact before enabling", () => {
    expect(validateSite({ ...siteDraft(site), enabled: true })).toHaveProperty("privacy_contact_email");
  });
  it("builds question keys and validates choice options", () => {
    expect(questionKey("Years of Java?")).toBe("years_of_java");
    expect(questionKey("Years of Java?", ["years_of_java"])).toBe("years_of_java_2");
    const q = { ...emptyQuestion([]), label: "Stack", type: "choice" as const, options: "Java" };
    expect(validateQuestions([q])).toHaveProperty("0.options");
    expect(toQuestions([{ ...q, options: "Java\nGo\n" }])[0].options).toEqual(["Java", "Go"]);
  });
});
