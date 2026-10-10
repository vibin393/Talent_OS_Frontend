import { describe, expect, it } from "vitest";
import type { PipelineStageTransition } from "@/lib/api/types";
import { isPublicPath } from "@/lib/navigation";
import { feedbackStatusOf, formatMatch } from "./format";
import { dropAction, liveStages, pipelineErrorMessage, reasonErrors, userMayMove, validDropTargets } from "./transitions";

const stage = (key: string, position: number, kind: "anchored" | "custom" = "anchored") => ({
  id: `id-${key}`,
  key,
  label: key[0].toUpperCase() + key.slice(1),
  kind,
  position,
  archived_at: null as string | null,
  terminal: ["hired", "rejected", "withdrawn"].includes(key),
});

const S = {
  applied: stage("applied", 0),
  screening: stage("screening", 1, "custom"),
  shortlisted: stage("shortlisted", 2),
  submitted: stage("submitted", 3),
  interviewing: stage("interviewing", 4),
  selected: stage("selected", 5),
  offered: stage("offered", 6),
  hired: stage("hired", 7),
  rejected: stage("rejected", 8),
  withdrawn: stage("withdrawn", 9),
};
const ALL = Object.values(S);

const t = (from: string, to: string, actors: string[]): PipelineStageTransition => ({
  from_stage_id: `id-${from}`,
  to_stage_id: `id-${to}`,
  actors,
  reason_required: false,
});
// A slice of the §5.2 table as `GET /pipeline/stages?include_transitions=true` returns it.
const T: PipelineStageTransition[] = [
  t("applied", "screening", ["user", "workflow"]),
  t("screening", "applied", ["user"]),
  t("applied", "shortlisted", ["user"]),
  t("screening", "shortlisted", ["user"]),
  t("shortlisted", "submitted", ["system"]),
  t("submitted", "interviewing", ["system", "user", "workflow"]),
  t("interviewing", "selected", ["user"]),
  t("selected", "offered", ["system"]),
  ...["applied", "screening", "shortlisted", "submitted", "interviewing", "selected", "offered"].flatMap((f) => [
    t(f, "rejected", ["user"]),
    t(f, "withdrawn", ["candidate", "user"]),
  ]),
  t("rejected", "applied", ["user"]),
  t("withdrawn", "applied", ["user"]),
];

describe("drop-target validity", () => {
  it("allows user transitions and refuses the rest", () => {
    expect(dropAction(S.applied, S.screening, T)).toEqual({ kind: "move" });
    expect(dropAction(S.screening, S.shortlisted, T)).toEqual({ kind: "move" });
    expect(dropAction(S.applied, S.interviewing, T).kind).toBe("invalid");
    expect(dropAction(S.selected, S.offered, T).kind).toBe("invalid"); // system only
  });
  it("opens the wizard for Shortlisted → Submitted and refuses other sources", () => {
    expect(dropAction(S.shortlisted, S.submitted, T)).toEqual({ kind: "wizard" });
    expect(dropAction(S.applied, S.submitted, T).kind).toBe("invalid");
  });
  it("asks for a reason on reject, withdraw and reopen", () => {
    expect(dropAction(S.interviewing, S.rejected, T)).toEqual({ kind: "reason", reason: "reject" });
    expect(dropAction(S.applied, S.withdrawn, T)).toEqual({ kind: "reason", reason: "withdraw" });
    expect(dropAction(S.rejected, S.applied, T)).toEqual({ kind: "reason", reason: "reopen" });
    expect(dropAction(S.hired, S.rejected, T).kind).toBe("invalid");
  });
  it("same stage is a no-op", () => expect(dropAction(S.applied, S.applied, T)).toEqual({ kind: "same" }));
  it("computes the valid target set used to dim columns", () => {
    expect([...validDropTargets(S.applied, ALL, T)].sort()).toEqual(["id-rejected", "id-screening", "id-shortlisted", "id-withdrawn"]);
    expect([...validDropTargets(S.shortlisted, ALL, T)]).toContain("id-submitted");
  });
  it("only counts the user actor", () => {
    expect(userMayMove(T, "id-selected", "id-offered")).toBe(false);
    expect(userMayMove(null, "id-applied", "id-screening")).toBe(false);
  });
  it("orders live stages and hides archived ones", () => {
    const archived = { ...stage("old", 1, "custom"), archived_at: "2026-01-01" };
    expect(liveStages([S.shortlisted, archived, S.applied]).map((s) => s.key)).toEqual(["applied", "shortlisted"]);
  });
});

describe("reason rules", () => {
  it("requires a reason code, and a note for other", () => {
    expect(reasonErrors("reject", null, "")).toEqual({ reason: "Choose a reason." });
    expect(reasonErrors("reject", "other", " ").note).toBeTruthy();
    expect(reasonErrors("withdraw", "personal", "")).toEqual({});
  });
  it("reopen needs a note only", () => {
    expect(reasonErrors("reopen", null, "").note).toBeTruthy();
    expect(reasonErrors("reopen", null, "client came back")).toEqual({});
  });
  it("maps API codes to copy", () => {
    expect(pipelineErrorMessage("use_submission_flow", "x")).toMatch(/Submit to client/);
    expect(pipelineErrorMessage("unknown_code", "fallback")).toBe("fallback");
  });
});

describe("format", () => {
  it("prefers a pending client rejection", () => {
    expect(feedbackStatusOf({ pending_client_rejection_id: "f1", latest_submission: null, last_client_feedback: null })).toBe(
      "rejected_pending",
    );
    expect(
      feedbackStatusOf({
        pending_client_rejection_id: null,
        latest_submission: { id: "s", human_id: "SUB-1", status: "sent", feedback_status: "interested", sent_at: null },
        last_client_feedback: null,
      }),
    ).toBe("interested");
  });
  it("formats match scores on either scale", () => {
    expect(formatMatch("0.87")).toBe("87%");
    expect(formatMatch(72)).toBe("72%");
    expect(formatMatch(null)).toBeNull();
  });
  it("treats /l/<token> as public (no login redirect)", () => {
    expect(isPublicPath("/l/abc123")).toBe(true);
    expect(isPublicPath("/leads")).toBe(false);
  });
});
