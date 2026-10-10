import { describe, expect, it } from "vitest";
import type { ScorecardDraft } from "@/features/interviews/scorecard";
import {
  applySuggestion,
  blockedMessage,
  formatOffset,
  isVideoFile,
  needsSpeakerStep,
  RECOMMENDATION_NOTE,
  suggestionFor,
  suggestionsVisibleByDefault,
  uploadError,
} from "./logic";

const file = (name: string, type = "") => ({ name, type }) as File;

const draft: ScorecardDraft = {
  ratings: { python: { rating: null, note: "my note" }, communication: { rating: 2, note: "" } },
  answers: {},
  recommendation: null,
  summary: "",
};

describe("Interview Assistant draft suggestions", () => {
  it("are hidden by default (tenant setting off or unknown)", () => {
    expect(suggestionsVisibleByDefault(undefined)).toBe(false);
    expect(suggestionsVisibleByDefault(false)).toBe(false);
    expect(suggestionsVisibleByDefault(true)).toBe(true);
  });

  it("'Use suggestion' fills only that competency and never the recommendation", () => {
    const out = applySuggestion(draft, "python", 4);
    expect(out.ratings.python).toEqual({ rating: 4, note: "my note" });
    expect(out.ratings.communication).toEqual({ rating: 2, note: "" });
    expect(out.recommendation).toBeNull();
    expect(draft.ratings.python.rating).toBeNull();
  });

  it("finds the suggestion of a competency and explains the empty recommendation", () => {
    const ratings = [{ competency_key: "python", label: "Python", suggested_rating: 4, rationale: "r", evidence: [] }];
    expect(suggestionFor(ratings, "python")?.suggested_rating).toBe(4);
    expect(suggestionFor(ratings, "communication")).toBeUndefined();
    expect(RECOMMENDATION_NOTE).toBe("Your call — the assistant never suggests a recommendation.");
  });
});

describe("Interview Assistant capture", () => {
  it("shows the blocked reason text", () => {
    expect(blockedMessage({ reason_texts: ["Waiting for Eli External to agree"] })).toBe("Recording isn't available: Waiting for Eli External to agree");
    expect(blockedMessage({ reason_texts: [] })).toContain("Recording isn't available");
  });

  it("rejects video files client-side", () => {
    expect(isVideoFile(file("call.mp4", "video/mp4"))).toBe(true);
    expect(isVideoFile(file("call.mov"))).toBe(true);
    expect(isVideoFile(file("call.m4a", "audio/mp4"))).toBe(false);
    expect(uploadError(null, file("call.mp4", "video/mp4"), true)).toBe("Video files aren't accepted. Only the words are used.");
    expect(uploadError(file("teams.vtt"), null, false)).toBe("Confirm this is the interview everyone agreed to record.");
    expect(uploadError(file("teams.vtt"), file("call.wav", "audio/wav"), true)).toBeNull();
    expect(uploadError(file("notes.pdf"), null, true)).toBe("Meeting transcripts must be VTT, TXT, SRT or DOCX.");
    expect(uploadError(null, null, true)).toBe("Choose a meeting transcript or a recording.");
  });

  it("requires the speaker step when speakers are unknown", () => {
    expect(needsSpeakerStep({ unknown_speakers: ["Speaker 2"] })).toBe(true);
    expect(needsSpeakerStep({ unknown_speakers: [] })).toBe(false);
    expect(needsSpeakerStep(undefined)).toBe(false);
  });

  it("formats transcript offsets", () => {
    expect(formatOffset(6000)).toBe("00:06");
    expect(formatOffset(125000)).toBe("02:05");
    expect(formatOffset(null)).toBe("");
  });
});
