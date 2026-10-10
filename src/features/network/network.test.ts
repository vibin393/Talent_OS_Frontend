import { describe, expect, it } from "vitest";
import { jobsQuery, type NetworkJobSummary } from "@/lib/api/network";
import { locationLabel, payLabel, relativeTime } from "./format";

const base: NetworkJobSummary = {
  id: "1",
  title: "Engineer",
  agency: "Acme",
  agency_slug: "acme",
  client_name: null,
  city: "Bengaluru",
  region: null,
  country: "IN",
  location_hidden: false,
  work_mode: "onsite",
  employment_type: "permanent",
  pay_min: null,
  pay_max: null,
  pay_currency: null,
  pay_period: null,
  published_at: new Date().toISOString(),
};

describe("payLabel", () => {
  it("returns null when pay is absent (card hides pay)", () => {
    expect(payLabel(base)).toBeNull();
  });
  it("formats a range with currency and period", () => {
    expect(payLabel({ ...base, pay_min: "1800000", pay_max: "2400000", pay_currency: "INR", pay_period: "year" })).toContain("INR");
    expect(payLabel({ ...base, pay_min: "1800000", pay_max: "2400000", pay_currency: "INR", pay_period: "year" })).toContain("/yr");
  });
});

describe("locationLabel", () => {
  it("shows 'Location on request' when hidden", () => {
    expect(locationLabel({ ...base, location_hidden: true, city: null })).toBe("Location on request");
  });
  it("shows 'Remote' for remote roles regardless of city", () => {
    expect(locationLabel({ ...base, work_mode: "remote" })).toBe("Remote");
  });
  it("joins city and country when shown", () => {
    expect(locationLabel(base)).toBe("Bengaluru, IN");
  });
});

describe("jobsQuery", () => {
  it("serializes filters and pagination", () => {
    const qs = jobsQuery({ q: "data", location: "Remote", work_mode: "remote", page: 2 }, 20, true);
    expect(qs).toContain("q=data");
    expect(qs).toContain("work_mode=remote");
    expect(qs).toContain("page=2");
    expect(qs).toContain("facets=1");
  });
  it("omits empty filters", () => {
    const qs = jobsQuery({ q: "  " });
    expect(qs).not.toContain("q=");
    expect(qs).toContain("page=1");
  });
});

describe("relativeTime", () => {
  it("returns 'today' for now", () => {
    expect(relativeTime(new Date().toISOString())).toBe("today");
  });
});
