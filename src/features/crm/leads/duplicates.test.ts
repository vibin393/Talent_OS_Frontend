import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { DuplicateMatch } from "../types";
import {
  acknowledgeFlag,
  duplicateMatchesFromError,
  duplicateReducer,
  matchHref,
  needsAcknowledgement,
  NO_DUPLICATES,
  shouldCheckDuplicates,
} from "./duplicates";

const client: DuplicateMatch = { kind: "client", id: "c1", name: "ACME Corp", reason: "name" };
const lead: DuplicateMatch = { kind: "lead", id: "l1", name: "Acme Corporation", reason: "similar_name", human_id: "LEAD-1" };

describe("lead duplicate warning flow", () => {
  it("only checks once the name is meaningful", () => {
    expect(shouldCheckDuplicates("Ac")).toBe(false);
    expect(shouldCheckDuplicates("Acme")).toBe(true);
    expect(shouldCheckDuplicates("", "acme.com")).toBe(true);
  });

  it("shows matches from the live check and requires Save anyway", () => {
    const s = duplicateReducer(NO_DUPLICATES, { type: "checked", matches: [client] });
    expect(needsAcknowledgement(s)).toBe(true);
    expect(acknowledgeFlag(s)).toBe(false);
    const ack = duplicateReducer(s, { type: "acknowledge" });
    expect(needsAcknowledgement(ack)).toBe(false);
    expect(acknowledgeFlag(ack)).toBe(true);
  });

  it("keeps the acknowledgement while matches are unchanged and drops it when they change", () => {
    const ack = duplicateReducer(duplicateReducer(NO_DUPLICATES, { type: "checked", matches: [client] }), { type: "acknowledge" });
    expect(duplicateReducer(ack, { type: "checked", matches: [client] }).acknowledged).toBe(true);
    expect(duplicateReducer(ack, { type: "checked", matches: [client, lead] }).acknowledged).toBe(false);
    expect(duplicateReducer(ack, { type: "checked", matches: [] })).toEqual({ matches: [], acknowledged: false });
  });

  it("turns a 409 possible_duplicate into a warning that allows retry with acknowledge", () => {
    const err = new ApiError(409, "possible_duplicate", "Possible duplicate", { matches: [client, lead] });
    const matches = duplicateMatchesFromError(err);
    expect(matches).toHaveLength(2);
    const s = duplicateReducer(NO_DUPLICATES, { type: "conflict", matches: matches! });
    expect(needsAcknowledgement(s)).toBe(true);
    expect(acknowledgeFlag(duplicateReducer(s, { type: "acknowledge" }))).toBe(true);
    expect(duplicateMatchesFromError(new ApiError(409, "lead_converted", "x"))).toBeNull();
  });

  it("links each match to its record", () => {
    expect(matchHref(client)).toBe("/clients/c1");
    expect(matchHref(lead)).toBe("/leads/l1");
  });
});
