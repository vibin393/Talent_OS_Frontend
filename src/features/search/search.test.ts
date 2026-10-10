import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { GlobalSearchOut, QuickHit } from "@/lib/api/types";
import { chipsFromState, listFromText, removeChip } from "./chips";
import { flatHits, hitSubtitle, INITIAL_NAV, navReducer, resultSections, seeAllHref } from "./global-search-state";
import { CARET, caretExcerpt, querySyntaxProblem } from "./query-error";
import { normalizeSnippet } from "./snippet";
import {
  EMPTY_FILTERS,
  EMPTY_STATE,
  filtersFromApi,
  filtersToApi,
  joinList,
  paramsToState,
  type SearchState,
  splitList,
  stateToParams,
  stateToRequest,
} from "./url-state";

const SKILL = "11111111-1111-4111-8111-111111111111";
const SKILL2 = "22222222-2222-4222-8222-222222222222";
const TAG = "33333333-3333-4333-8333-333333333333";
const OWNER = "44444444-4444-4444-8444-444444444444";
const CLIENT = "55555555-5555-4555-8555-555555555555";

const FULL: SearchState = {
  mode: "boolean",
  q: '("data engineer" OR dataengineer) AND databricks NOT sas',
  nlq: "",
  interpreted: false,
  sem: "",
  filters: {
    skills: [SKILL, SKILL2],
    skillsMode: "all",
    expMin: 3,
    expMax: 8.5,
    countries: ["India"],
    cities: ["Pune", "Bengaluru, KA"],
    workAuth: ["H1B"],
    compMin: 1000000,
    compMax: 3000000,
    compCurrency: "USD",
    noticeMaxDays: 30,
    availableBy: "2026-11-15",
    certifications: ["AZ-900"],
    employers: ["HDFC"],
    tags: [TAG],
    sources: ["referral"],
    owners: [OWNER],
    updatedAfter: "2026-01-01",
    updatedBefore: "2026-09-30",
    notSubmittedTo: CLIENT,
  },
  sort: "experience",
  page: 3,
  labels: { [SKILL]: "Databricks", [SKILL2]: "C, C++", [TAG]: "Hot", [CLIENT]: "Acme" },
};

describe("url-state", () => {
  it("round-trips every field through readable params", () => {
    const params = stateToParams(FULL);
    expect(params.get("exp")).toBe("3-8.5");
    expect(params.get("skills_mode")).toBe("all");
    expect(params.get("sort")).toBe("experience");
    const back = paramsToState(new URLSearchParams(params.toString()));
    expect(back.filters).toEqual(FULL.filters);
    expect(back.q).toBe(FULL.q);
    expect(back.sort).toBe("experience");
    expect(back.page).toBe(3);
    expect(back.labels[SKILL2]).toBe("C, C++");
    expect(back.labels[CLIENT]).toBe("Acme");
  });

  it("omits defaults and restores the empty state", () => {
    expect(stateToParams(EMPTY_STATE).toString()).toBe("");
    expect(paramsToState(new URLSearchParams(""))).toEqual(EMPTY_STATE);
  });

  it("keeps the interpreted NL state so a shared link needs no AI call", () => {
    const nl: SearchState = {
      ...EMPTY_STATE,
      mode: "nl",
      nlq: "Data engineers with Databricks",
      interpreted: true,
      q: "(banking)",
      sem: "data engineer databricks",
      filters: { ...EMPTY_FILTERS, skills: [SKILL] },
      labels: { [SKILL]: "Databricks" },
    };
    const back = paramsToState(stateToParams(nl));
    expect(back).toEqual(nl);
    expect(stateToRequest(back)).toMatchObject({ mode: "structured", q: "(banking)", semantic_text: "data engineer databricks" });
    expect(stateToRequest({ ...back, interpreted: false })).toMatchObject({ mode: "nl", q: "Data engineers with Databricks" });
  });

  it("drops invalid ids, dates and numbers", () => {
    const s = paramsToState(new URLSearchParams("skills=nope,1;drop&avail=tomorrow&exp=x-5&page=-2&sort=bogus&notice=900"));
    expect(s.filters.skills).toEqual([]);
    expect(s.filters.availableBy).toBeNull();
    expect(s.filters.expMin).toBeNull();
    expect(s.filters.expMax).toBe(5);
    expect(s.page).toBe(1);
    expect(s.sort).toBe("relevance");
    expect(s.filters.noticeMaxDays).toBe(365);
  });

  it("escapes commas in list values", () => {
    expect(splitList(joinList(["a,b", "c\\d", "e"]))).toEqual(["a,b", "c\\d", "e"]);
  });

  it("maps filters to and from the API", () => {
    const api = filtersToApi(FULL.filters);
    expect(api).toMatchObject({ skills: [SKILL, SKILL2], experience_min: 3, owner_ids: [OWNER], current_employers: ["HDFC"] });
    expect(filtersToApi(EMPTY_FILTERS)).toEqual({ skills_mode: "any", comp_currency: "INR" });
    expect(filtersFromApi({ ...api, experience_min: "3.0", comp_max: "3000000.00" })).toEqual(FULL.filters);
  });
});

describe("query syntax errors", () => {
  it("marks the error position with a caret", () => {
    expect(caretExcerpt("databricks AND (azure", 16)).toBe(`…abricks AND ${CARET}(azure`);
    expect(caretExcerpt("a AND", 6)).toBe(`a AND${CARET}`);
    expect(caretExcerpt("x", 0)).toBe(`${CARET}x`);
  });

  it("reads the 422 invalid_query envelope only", () => {
    const err = new ApiError(422, "invalid_query", "Unclosed parenthesis", { position: 16, message: "Unclosed parenthesis" });
    expect(querySyntaxProblem(err, "databricks AND (azure")).toEqual({
      message: "Unclosed parenthesis",
      position: 16,
      excerpt: `…abricks AND ${CARET}(azure`,
    });
    expect(querySyntaxProblem(new ApiError(422, "validation_error", "x"), "q")).toBeNull();
    expect(querySyntaxProblem(new Error("x"), "q")).toBeNull();
  });
});

describe("NL chips", () => {
  const state: SearchState = {
    ...EMPTY_STATE,
    mode: "nl",
    interpreted: true,
    q: "banking",
    sem: "data engineer",
    filters: { ...EMPTY_FILTERS, skills: [SKILL], skillsMode: "all", expMin: 3, compMax: 2000000, cities: ["Pune"] },
    labels: { [SKILL]: "Databricks" },
  };

  it("derives one chip per interpreted filter", () => {
    const chips = chipsFromState(state);
    expect(chips.map((c) => c.key)).toEqual(["keywords", "skills", "experience", "cities", "compensation", "semantic"]);
    expect(chips.find((c) => c.key === "skills")).toMatchObject({ label: "Skills (all)", value: "Databricks" });
    expect(chips.find((c) => c.key === "experience")?.value).toBe("≥ 3 yrs");
  });

  it("hides the compensation chip without compensation:view", () => {
    expect(chipsFromState(state, { canViewComp: false }).some((c) => c.key === "compensation")).toBe(false);
  });

  it("removing a chip clears exactly its filter", () => {
    const next = removeChip({ ...state, page: 4 }, "skills");
    expect(next.filters.skills).toEqual([]);
    expect(next.filters.skillsMode).toBe("any");
    expect(next.filters.cities).toEqual(["Pune"]);
    expect(next.page).toBe(1);
    expect(removeChip(state, "keywords").q).toBe("");
    expect(removeChip(state, "semantic").sem).toBe("");
    expect(chipsFromState(removeChip(state, "compensation")).some((c) => c.key === "compensation")).toBe(false);
  });

  it("parses comma-separated editor values", () => {
    expect(listFromText(" Pune, , Mumbai,Pune ")).toEqual(["Pune", "Mumbai"]);
  });
});

describe("snippet", () => {
  it("keeps markup as plain text and merges segments", () => {
    const out = normalizeSnippet([
      { text: "<script>alert(1)</script> ", hl: false },
      { text: "Data\u0001bricks", hl: true },
      { text: "", hl: false },
      { text: " expert", hl: true },
    ]);
    expect(out).toEqual([
      { text: "<script>alert(1)</script> ", hl: false },
      { text: "Databricks expert", hl: true },
    ]);
    expect(normalizeSnippet(null)).toEqual([]);
  });
});

const hit = (type: QuickHit["type"], id: string, title = id): QuickHit => ({ id, type, title, url: `/${type}s/${id}` });

describe("global search", () => {
  const out: GlobalSearchOut = {
    exact: hit("demand", "d1", "REQ-1056"),
    groups: [
      { type: "contact", items: [hit("contact", "p1")], has_more: false, timed_out: false },
      { type: "demand", items: [hit("demand", "d1"), hit("demand", "d2")], has_more: true, timed_out: false },
      { type: "candidate", items: [hit("candidate", "c1")], has_more: false, timed_out: false },
      { type: "client", items: [], has_more: false, timed_out: true },
    ],
  };

  it("pins the exact hit first, then groups in M365 order without repeating it", () => {
    const sections = resultSections(out);
    expect(sections.map((s) => s.key)).toEqual(["top", "candidate", "demand", "client", "contact"]);
    expect(flatHits(sections).map((h) => h.id)).toEqual(["d1", "c1", "d2", "p1"]);
    expect(sections.find((s) => s.key === "client")?.timedOut).toBe(true);
  });

  it("drops empty groups and handles no data", () => {
    expect(resultSections({ exact: null, groups: [{ type: "client", items: [], has_more: false, timed_out: false }] })).toEqual([]);
    expect(resultSections(undefined)).toEqual([]);
  });

  it("moves through options with wrap-around and closes on Escape", () => {
    let s = navReducer(INITIAL_NAV, { type: "open" });
    expect(s).toEqual({ open: true, active: -1 });
    s = navReducer(s, { type: "move", delta: 1, count: 3 });
    expect(s.active).toBe(0);
    s = navReducer(s, { type: "move", delta: -1, count: 3 });
    expect(s.active).toBe(2);
    s = navReducer(s, { type: "move", delta: 1, count: 3 });
    expect(s.active).toBe(0);
    expect(navReducer(INITIAL_NAV, { type: "move", delta: -1, count: 3 })).toEqual({ open: true, active: 2 });
    expect(navReducer(s, { type: "move", delta: 1, count: 0 }).active).toBe(-1);
    expect(navReducer(s, { type: "close" })).toEqual(INITIAL_NAV);
  });

  it("does not repeat the human id in the subtitle", () => {
    expect(hitSubtitle({ human_id: "REQ-0001", subtitle: "REQ-0001 · draft" })).toBe("REQ-0001 · draft");
    expect(hitSubtitle({ human_id: "CAN-1", subtitle: "a@b.co" })).toBe("CAN-1 · a@b.co");
    expect(hitSubtitle({ human_id: null, subtitle: "Acme" })).toBe("Acme");
  });

  it("links to the full candidate search", () => {
    expect(seeAllHref(" jane doe ")).toBe("/candidates/search?q=jane%20doe");
  });
});
