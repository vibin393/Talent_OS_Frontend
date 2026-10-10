import { describe, expect, it } from "vitest";
import { afterConfirm, aiFieldLabel, aiFieldTooltip, pendingAiFields } from "./ai-fields";
import { API_TO_FORM, buildDemandUpdate, demandFormDefaults } from "./form";
import type { DemandOut } from "@/lib/api/types";

describe("AI-extracted fields", () => {
  it("labels fields", () => {
    expect(aiFieldLabel("mandatory_skills")).toBe("Mandatory skills");
    expect(aiFieldLabel("some_field")).toBe("some field");
  });

  it("finds pending fields among a group", () => {
    expect(pendingAiFields(["title", "bill_rate"], ["title", "location"])).toEqual(["title"]);
    expect(pendingAiFields(null, ["title"])).toEqual([]);
  });

  it("confirms one field or all", () => {
    expect(afterConfirm(["title", "country"], ["title"])).toEqual(["country"]);
    expect(afterConfirm(["title", "country"])).toEqual([]);
  });

  it("maps every AI field to a form field", () => {
    for (const f of ["title", "mandatory_skills", "preferred_skills", "bill_rate", "start_date", "certifications"]) {
      expect(API_TO_FORM[f]).toBeDefined();
    }
  });
});

const demand = {
  id: "d1",
  req_id: "REQ-0001",
  title: "Data engineer",
  client_id: "c1",
  client_name: "Acme",
  end_client: null,
  hiring_manager_contact_id: null,
  positions: 2,
  department: null,
  employment_type: "contract",
  country: "IN",
  location: "Pune",
  work_mode: "hybrid",
  min_experience_years: "5.0",
  max_experience_years: null,
  education: null,
  certifications: [],
  work_authorization: [],
  clearance: null,
  languages: [],
  shift: null,
  travel_percent: null,
  start_date: null,
  target_closure_date: null,
  priority: "medium",
  bill_rate: "1500.00",
  pay_rate_min: null,
  pay_rate_max: null,
  currency: "INR",
  rate_unit: "hour",
  submission_limit: null,
  interview_plan: [],
  status: "draft",
  status_reason_code: null,
  status_comment: null,
  progress: null,
  owner_id: "u1",
  business_unit_id: null,
  ai_extracted_fields: ["title"],
  intake_ai_action_id: null,
  published_jd_version_id: null,
  applications_count: 0,
  submissions_count: 0,
  interviews_scheduled_count: 0,
  offers_released_count: 0,
  positions_filled: 0,
  opened_at: null,
  archived_at: null,
  created_at: "2026-09-30T00:00:00Z",
  updated_at: "2026-09-30T00:00:00Z",
  skills: [{ label: "Python", skill_id: null, skill_ref_kind: null, kind: "mandatory", min_years: null }],
} satisfies DemandOut;

describe("demand update body", () => {
  it("is empty when nothing changed (so no AI badge is cleared)", () => {
    expect(buildDemandUpdate(demand, demandFormDefaults(demand), true)).toEqual({});
  });

  it("sends only the edited fields", () => {
    const v = { ...demandFormDefaults(demand), title: "Senior data engineer", billRate: "1500" };
    expect(buildDemandUpdate(demand, v, true)).toEqual({ title: "Senior data engineer" });
  });

  it("never sends compensation without compensation:view", () => {
    const v = { ...demandFormDefaults(demand), billRate: "9999" };
    expect(buildDemandUpdate(demand, v, false)).toEqual({});
  });
});

describe("AI-extracted field source quote (Epic 55)", () => {
  it("shows the Demand Agent quote in the tooltip, else the P1 text", () => {
    expect(aiFieldTooltip("Location", "Pune hybrid")).toBe("AI-extracted from the client email: “Pune hybrid”");
    expect(aiFieldTooltip("Location", null)).toBe("Location was extracted by AI. Check it, then confirm or edit it.");
    expect(aiFieldTooltip("Location", "   ")).toBe("Location was extracted by AI. Check it, then confirm or edit it.");
  });
});
