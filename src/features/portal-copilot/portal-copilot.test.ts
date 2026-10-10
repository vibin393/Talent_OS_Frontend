import { describe, expect, it } from "vitest";
import { API_BASE } from "./api";
import {
  allowedLink,
  draftTitle,
  isExpired,
  isPublicPath,
  linkLabel,
  PC_COPY,
  PLACEHOLDER,
  rateLimitText,
  STARTERS,
  unavailableText,
} from "./logic";

describe("portal Copilot (Epic 77 B5)", () => {
  it("routes each portal to its own apiBase", () => {
    expect(API_BASE).toEqual({
      client: "/api/v1/client-portal/copilot",
      vendor: "/api/v1/vendor-portal/copilot",
      candidate: "/api/v1/portal/copilot",
    });
  });

  it("shows the unavailable states with the exact copy", () => {
    expect(unavailableText("not_enabled", "Acme")).toBe("Copilot is not turned on for this portal");
    expect(unavailableText("kill_switch", "Acme")).toBe("Copilot is paused by Acme");
    expect(unavailableText("budget_exhausted", "Acme")).toBe("Copilot has reached its limit for this month");
    expect(unavailableText("principal_inactive", "Acme")).toBe("Your access changed. Refresh the page.");
    expect(unavailableText("consent_required", "Acme")).toBeNull(); // the consent card gates instead
    expect(unavailableText(null, "Acme")).toBeNull();
  });

  it("formats the rate-limit message with the time the window reopens", () => {
    const now = new Date("2026-10-10T10:20:00Z");
    expect(rateLimitText(600, now)).toMatch(/^You've asked a lot of questions this hour\. Try again at .+\.$/);
  });

  it("uses the portal placeholders, starters and disclosure", () => {
    expect(PLACEHOLDER.client).toBe("Ask about your requirements, candidates or invoices…");
    expect(PLACEHOLDER.vendor).toBe("Ask about releases, submissions or statements…");
    expect(PLACEHOLDER.candidate).toBe("Ask about your application or interview…");
    expect(STARTERS.client).toContain("Which candidates are waiting for my feedback?");
    expect(STARTERS.candidate).toContain("When is my next interview?");
    expect(PC_COPY.disclosure("Acme")).toBe(
      "Copilot is an AI assistant acting for Acme. It can see only what you can see here and can make mistakes.",
    );
    expect(PC_COPY.toggle).toBe("Ask Copilot");
  });

  it("titles drafts per tool and detects expiry", () => {
    expect(draftTitle({ tool_key: "portal_client.draft_message", title: "x", preview: null })).toBe("Draft: message to your account manager");
    expect(draftTitle({ tool_key: "portal_candidate.draft_handoff", title: "x", preview: null })).toBe("Draft: ask your recruiter");
    expect(
      draftTitle({ tool_key: "portal_client.draft_submission_feedback", title: "t", preview: { title: "Draft: feedback for Ann K.", summary: "", fields: [] } }),
    ).toBe("Draft: feedback for Ann K.");
    const now = new Date("2026-10-10T10:00:00Z");
    expect(isExpired({ status: "pending", expires_at: "2026-10-10T09:00:00Z" }, now)).toBe(true);
    expect(isExpired({ status: "pending", expires_at: "2026-10-11T09:00:00Z" }, now)).toBe(false);
    expect(isExpired({ status: "expired", expires_at: null }, now)).toBe(true);
  });

  it("renders ★ answers as same-portal link buttons only", () => {
    expect(linkLabel("/client/approvals")).toBe("Open Approvals");
    expect(linkLabel("/portal/offers")).toBe("Open Offers");
    expect(allowedLink("client", "/client/approvals")).toBe(true);
    expect(allowedLink("client", "/vendor/releases")).toBe(false);
    expect(allowedLink("vendor", "https://evil.example.com")).toBe(false);
    expect(allowedLink("candidate", "/careers/acme/jobs/1")).toBe(true);
  });

  it("never mounts on sign-in pages", () => {
    expect(isPublicPath("client", "/client/sign-in")).toBe(true);
    expect(isPublicPath("vendor", "/vendor/accept-invite/x")).toBe(true);
    expect(isPublicPath("candidate", "/portal/applications")).toBe(false);
  });
});
