import { describe, expect, it, vi } from "vitest";
import type { WonPreviewOut } from "../types";
import { buildWinIn, createWinSession, selectionErrors, selectionFromPreview, selectionSummary } from "./won-logic";

const preview: WonPreviewOut = {
  opportunity_id: "o1",
  client: { id: "c1", name: "Acme Robotics", current_status: "prospect", will_activate: true },
  contract: { type: "msa", title: "Acme Robotics MSA", legal_entity_id: null, start_date: "2026-10-05" },
  legal_entities: [{ id: "le1", name: "Talent OS India Pvt Ltd" }],
  rate_card_templates: [{ id: "t1", name: "Standard IT" }],
  demands: ["Java dev", "QA", "PM"].map((title, i) => ({
    line_id: `l${i}`,
    title,
    positions: 2,
    bill_rate: "1500.0000",
    currency: "INR",
    rate_unit: "hour",
    location: "Pune",
    owner_id: "am1",
  })),
  commercials_available: true,
};

describe("Won dialog selection", () => {
  it("summarises what will be created", () => {
    const s = selectionFromPreview(preview);
    expect(s.legalEntityId).toBe("le1");
    expect(selectionSummary(s)).toBe("This will create: 1 Contract, 1 Rate Card, 3 Demands and activate the client");
    const fewer = { ...s, activateClient: false, copyRateCard: false, demands: s.demands.map((d, i) => ({ ...d, create: i === 0 })) };
    expect(selectionSummary(fewer)).toBe("This will create: 1 Contract, 1 Demand");
    expect(selectionSummary({ ...fewer, createContract: false, demands: [] })).toBe("No new records will be created");
  });

  it("sends only changed demand fields as overrides", () => {
    const s = selectionFromPreview(preview);
    s.demands[1] = { ...s.demands[1], title: "QA Lead", billRate: "1800" };
    s.demands[2] = { ...s.demands[2], create: false };
    const body = buildWinIn(s);
    expect(body.activate_client).toBe(true);
    expect(body.contract).toMatchObject({ create: true, type: "msa", legal_entity_id: "le1", start_date: "2026-10-05" });
    expect(body.rate_card).toEqual({ template_id: "t1", effective_from: "2026-10-05" });
    expect(body.demands[0]).toEqual({ line_id: "l0", create: true, overrides: null });
    expect(body.demands[1].overrides).toEqual({ title: "QA Lead", bill_rate: "1800" });
    expect(body.demands[2].create).toBe(false);
  });

  it("validates required contract fields", () => {
    const s = { ...selectionFromPreview(preview), startDate: "" };
    expect(selectionErrors(s)).toContain("Contract start date is required.");
    expect(selectionErrors(selectionFromPreview(preview))).toEqual([]);
  });

  it("keeps the Idempotency-Key stable across retries", async () => {
    let n = 0;
    const session = createWinSession(() => `key-${++n}`);
    const send = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce("ok");
    await expect(session.submit(send)).rejects.toThrow("network");
    await expect(session.submit(send)).resolves.toBe("ok");
    expect(send.mock.calls.map((c) => c[0])).toEqual(["key-1", "key-1"]);
    expect(createWinSession(() => `key-${++n}`).key).toBe("key-2");
  });
});
