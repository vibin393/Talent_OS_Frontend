import { describe, expect, it } from "vitest";
import {
  ALLOWED_DIMENSIONS,
  answersPayload,
  cellText,
  defaultAnswers,
  defaultRunDraft,
  dimensionOptions,
  fourFifthsBadge,
  isAllowedDimension,
  isSuppressedCell,
  orderedRows,
  packFileHref,
  PREFER_NOT,
  runCreatePayload,
  runDraftErrors,
  scoreHiddenLabel,
  scoreHiddenReason,
  showNoticeBlock,
  tableTitle,
  visibleDimensions,
} from "./logic";
import type { DimensionOut, PublicNoticeOut, SnapshotRow } from "./types";

function dim(key: string, over: Partial<DimensionOut> = {}): DimensionOut {
  return {
    key: key as DimensionOut["key"],
    label: key,
    enabled: true,
    position: 0,
    options: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
      { key: PREFER_NOT, label: "Prefer not to say" },
    ],
    ...over,
  };
}

function row(over: Partial<SnapshotRow> = {}): SnapshotRow {
  return {
    category: "woman",
    label: "Woman",
    unknown: false,
    suppressed: false,
    applicants: 40,
    selected: 10,
    rate: "0.25",
    impact_ratio: "0.8125",
    flag: false,
    ...over,
  };
}

const NOTICE: PublicNoticeOut = {
  applies: true,
  notice_text: "We use AEDTs.",
  qualifications_text: null,
  data_retention_text: null,
  alternative_process_text: null,
  aedts: [],
};

describe("self-ID defaults", () => {
  it("defaults every enabled dimension to prefer_not_to_say", () => {
    const dims = [dim("gender", { position: 1 }), dim("age_band", { position: 2 }), dim("disability", { position: 3, enabled: false })];
    expect(defaultAnswers(dims)).toEqual({ gender: PREFER_NOT, age_band: PREFER_NOT });
  });

  it("keeps a valid existing answer and resets an unknown one", () => {
    const dims = [dim("gender"), dim("age_band")];
    expect(defaultAnswers(dims, { gender: "a", age_band: "zzz" })).toEqual({ gender: "a", age_band: PREFER_NOT });
  });

  it("always offers prefer_not_to_say, last", () => {
    const d = dim("gender", { options: [{ key: "a", label: "A" }] });
    const opts = dimensionOptions(d);
    expect(opts[opts.length - 1].key).toBe(PREFER_NOT);
    expect(dimensionOptions(dim("gender")).filter((o) => o.key === PREFER_NOT)).toHaveLength(1);
  });
});

describe("dimension guard", () => {
  it("allows exactly gender, age band and disability", () => {
    expect([...ALLOWED_DIMENSIONS].sort()).toEqual(["age_band", "disability", "gender"]);
    for (const bad of ["religion", "caste", "race", "ethnicity", "", null, 3]) expect(isAllowedDimension(bad)).toBe(false);
  });

  it("never renders or submits a dimension outside the three", () => {
    const dims = [dim("gender"), dim("religion"), dim("caste")];
    expect(visibleDimensions(dims).map((d) => d.key)).toEqual(["gender"]);
    const payload = answersPayload(dims, { gender: "b", religion: "x" } as never);
    expect(Object.keys(payload)).toEqual(["gender"]);
    expect(Object.keys(defaultAnswers(dims))).toEqual(["gender"]);
  });
});

describe("suppressed cells", () => {
  it('renders suppressed string cells verbatim ("<5")', () => {
    expect(isSuppressedCell("<5")).toBe(true);
    expect(cellText("<5")).toBe("<5");
    expect(cellText("", "<7")).toBe("<7");
    expect(isSuppressedCell(12)).toBe(false);
    expect(cellText(1234)).toBe("1,234");
    expect(cellText(null)).toBe("—");
  });
});

describe("report rows", () => {
  it("keeps the unknown row and sorts it last", () => {
    const rows = [row({ category: "unknown", label: "Unknown", unknown: true }), row({ category: "man" }), row()];
    const out = orderedRows(rows);
    expect(out).toHaveLength(3);
    expect(out[out.length - 1].unknown).toBe(true);
  });

  it("adds an unknown row when the API omitted it", () => {
    const out = orderedRows([row()]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ unknown: true, applicants: 0 });
    expect(orderedRows([]).map((r) => r.unknown)).toEqual([true]);
  });

  it("maps the four-fifths flag to a badge", () => {
    expect(fourFifthsBadge(true)?.color).toBe("danger");
    expect(fourFifthsBadge(false)?.color).toBe("success");
    expect(fourFifthsBadge(null)).toBeNull();
  });

  it("titles intersection tables", () => {
    expect(tableTitle(["gender", "age_band"], "gender×age_band")).toBe("Gender × Age band");
    expect(tableTitle([], "gender×disability")).toBe("Gender × Disability");
  });
});

describe("notice block", () => {
  it("renders only when the notice applies", () => {
    expect(showNoticeBlock(NOTICE)).toBe(true);
    expect(showNoticeBlock({ ...NOTICE, applies: false })).toBe(false);
    expect(showNoticeBlock(null)).toBe(false);
    expect(showNoticeBlock(undefined)).toBe(false);
  });
});

describe("run form", () => {
  it("requires the selection point parameters", () => {
    const d = defaultRunDraft(new Date(2026, 9, 7));
    expect(d.date_from).toBe("2025-10-07");
    expect(runDraftErrors(d)).toEqual({});
    expect(runDraftErrors({ ...d, selection_point: "stage_transition" }).to_stage_key).toBeTruthy();
    expect(runDraftErrors({ ...d, min_score: 101 }).min_score).toBeTruthy();
    expect(runDraftErrors({ ...d, date_from: "2026-12-01" }).date_to).toBeTruthy();
  });

  it("builds a payload with only the relevant params and filters", () => {
    const d = { ...defaultRunDraft(new Date(2026, 9, 7)), job_category: " IT " };
    expect(runCreatePayload(d)).toMatchObject({
      selection_point: "ai_match_threshold",
      params: { min_score: 70 },
      filters: { job_category: "IT" },
      intersections: ["gender×age_band"],
    });
  });

  it("resolves pack file links", () => {
    expect(packFileHref("/api/v1/fairness/runs/1/pack/files/a.pdf")).toBe("/api/v1/fairness/runs/1/pack/files/a.pdf");
    expect(packFileHref("/fairness/runs/1/pack/files/a.pdf")).toBe("/api/v1/fairness/runs/1/pack/files/a.pdf");
  });
});

describe("hidden scores", () => {
  it("reads score_hidden_reason defensively", () => {
    expect(scoreHiddenReason({ score_hidden_reason: "alternative_process" })).toBe("alternative_process");
    expect(scoreHiddenReason({ score_hidden_reason: "other" })).toBeNull();
    expect(scoreHiddenReason(null)).toBeNull();
    expect(scoreHiddenLabel("notice_period")).toBe("Hidden — notice period");
    expect(scoreHiddenLabel("alternative_process")).toBe("Hidden — alternative process requested");
  });
});
