import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import {
  addSource,
  importFileError,
  reasonLabel,
  removeSource,
  sameSources,
  sourcesFromAudience,
  sourcesToPayload,
  suppressedRows,
  suppressedTotal,
} from "./logic";
import { ReachPreviewCard, SuppressedTable } from "./reach-preview";
import type { AudiencePreviewOut } from "./types";

function render(el: ReactElement): string {
  return renderToStaticMarkup(createElement(FluentProvider, { theme: webLightTheme }, el));
}

const PREVIEW: AudiencePreviewOut = {
  audience_id: "a1",
  total: 1200,
  reachable: { email: 1000, sms: 700, whatsapp: 300 },
  suppressed: {
    email: { no_marketing_consent: 150, hard_bounce: 50 },
    sms: { no_marketing_consent: 150, channel_opt_out: 30, no_address: 320 },
    whatsapp: { no_whatsapp_optin: 750, no_marketing_consent: 150 },
  },
  elapsed_ms: 1840,
};

describe("audience sources", () => {
  const a = { mode: "include" as const, kind: "pool" as const, id: "p1", name: "Java" };

  it("adds without duplicates and removes by key", () => {
    const one = addSource([], a);
    expect(addSource(one, { ...a })).toBe(one);
    const two = addSource(one, { ...a, mode: "exclude" });
    expect(two).toHaveLength(2);
    expect(removeSource(two, { mode: "exclude", kind: "pool", id: "p1" })).toEqual([a]);
    expect(sameSources(two, [...two].reverse())).toBe(true);
    expect(sameSources(one, two)).toBe(false);
  });

  it("maps server sources to drafts and back to the payload", () => {
    const drafts = sourcesFromAudience({
      sources: [
        { id: "s1", mode: "include", kind: "pool", talent_pool_id: "p1", segment_id: null, name: "Java" },
        { id: "s2", mode: "exclude", kind: "segment", talent_pool_id: null, segment_id: "g1", name: null },
      ],
    });
    expect(drafts).toEqual([a, { mode: "exclude", kind: "segment", id: "g1", name: "Unnamed" }]);
    expect(sourcesToPayload(drafts)).toEqual([
      { mode: "include", kind: "pool", talent_pool_id: "p1" },
      { mode: "exclude", kind: "segment", segment_id: "g1" },
    ]);
  });

  it("checks the import file", () => {
    expect(importFileError(null)).toMatch(/Choose/);
    expect(importFileError({ name: "list.pdf", size: 10 })).toMatch(/CSV or XLSX/);
    expect(importFileError({ name: "list.CSV", size: 10 })).toBeNull();
    expect(importFileError({ name: "list.xlsx", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});

describe("reach preview", () => {
  it("pivots suppression by reason, largest first", () => {
    const rows = suppressedRows(PREVIEW);
    expect(rows[0]).toMatchObject({ reason: "no_whatsapp_optin", whatsapp: 750, email: 0 });
    expect(rows.find((r) => r.reason === "no_marketing_consent")).toMatchObject({ email: 150, sms: 150, whatsapp: 150 });
    expect(rows.map((r) => r.reason)).toHaveLength(5);
    expect(suppressedTotal(PREVIEW, "sms")).toBe(500);
    expect(suppressedTotal(PREVIEW)).toBe(900);
    expect(reasonLabel("frequency_cap")).toBe("Frequency cap");
    expect(reasonLabel("new_reason")).toBe("new reason");
  });

  it("renders the suppressed-by-reason table", () => {
    const html = render(createElement(SuppressedTable, { preview: PREVIEW }));
    expect(html).toContain('aria-label="Suppressed by reason"');
    expect(html).toContain("No marketing consent");
    expect(html).toContain("No WhatsApp opt-in");
    expect(html).toContain(">750<");
    expect((html.match(/<tr/g) ?? []).length).toBe(6);
  });

  it("renders an empty suppression state", () => {
    expect(render(createElement(SuppressedTable, { preview: { suppressed: {} } }))).toContain("No one is suppressed.");
  });

  it("renders the preview card with total, reachable badges and a spinner while loading", () => {
    const html = render(createElement(ReachPreviewCard, { preview: PREVIEW, loading: false }));
    expect(html).toContain("Preview reach");
    expect(html).toContain("1,200");
    expect(html).toContain("Email: 1,000 reachable");
    expect(html).toContain("WhatsApp: 300 reachable");
    const loading = render(createElement(ReachPreviewCard, { preview: null, loading: true }));
    expect(loading).toContain("Counting reachable people");
    expect(loading).toContain('aria-busy="true"');
  });
});
