import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { LeadOut } from "../types";
import { applyConvertError, buildConvertIn, initialWizard, stepErrors } from "./convert-logic";

const lead = {
  id: "lead1",
  human_id: "LEAD-7",
  company_name: "Acme Robotics",
  website: "https://acme.example",
  gstin: null,
  industry: "Manufacturing",
  contact_name: "Priya Sharma",
  contact_title: "CTO",
  contact_email: "priya@acme.example",
  contact_phone: null,
  expected_annual_revenue: "2500000.00",
  currency: "INR",
  owner_id: "u1",
  owner: { id: "u1", name: "Sales User" },
  estimated_roles: [
    { title: "Java developer", positions: 3 },
    { title: "QA", positions: 1 },
  ],
} as unknown as LeadOut;

describe("convert wizard", () => {
  it("pre-fills client, contact and opportunity lines from the lead", () => {
    const s = initialWizard(lead);
    expect(s.client).toMatchObject({ mode: "create", name: "Acme Robotics" });
    expect(s.contact).toMatchObject({ mode: "create", firstName: "Priya", lastName: "Sharma" });
    expect(s.opportunity.lines).toEqual([
      { title: "Java developer", positions: 3 },
      { title: "QA", positions: 1 },
    ]);
    const body = buildConvertIn(s);
    expect(body.client).toMatchObject({ mode: "create", name: "Acme Robotics", website: "https://acme.example" });
    expect(body.opportunity.lines).toHaveLength(2);
    expect(body.opportunity.estimated_revenue).toBe("2500000.00");
  });

  it("switches to link mode with the suggested client on 409 client_exists", () => {
    const s = { ...initialWizard(lead), step: 2 as const };
    const err = new ApiError(409, "client_exists", "Client exists", { client_id: "c9" });
    const next = applyConvertError(s, err)!;
    expect(next.step).toBe(0);
    expect(next.client).toEqual({ mode: "link", clientId: "c9", clientName: "Acme Robotics", suggested: true });
    expect(next.notice).toMatch(/already exists/);
    expect(buildConvertIn(next).client).toEqual({ mode: "link", client_id: "c9" });
    expect(stepErrors(next)).toEqual([]);
  });

  it("ignores other errors", () => {
    expect(applyConvertError(initialWizard(lead), new ApiError(409, "lead_converted", "x"))).toBeNull();
    expect(applyConvertError(initialWizard(lead), new Error("x"))).toBeNull();
  });

  it("validates each step", () => {
    const s = initialWizard(lead);
    expect(stepErrors({ ...s, client: { mode: "link", clientId: null, clientName: "", suggested: false } })).toEqual([
      "Choose a client to link.",
    ]);
    expect(stepErrors({ ...s, step: 2, opportunity: { ...s.opportunity, estimatedRevenue: "abc" } })).toEqual([
      "Estimated revenue must be a number.",
    ]);
  });
});
