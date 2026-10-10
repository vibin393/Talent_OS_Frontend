import { describe, expect, it } from "vitest";
import { speakerGroups } from "./speaker-labeller";
import { callChip, consentError, formatTimestamp, playbackAt, recordingChip, recordingDisabledReason, STATUS_LABELS, uploadError } from "./logic";

const file = (name: string) => new File(["x"], name);

describe("voice screening logic", () => {
  it("requires something to upload and both attestation boxes", () => {
    expect(uploadError(null, null, true, true)).toBe("Choose a transcript or a recording.");
    expect(uploadError(file("a.vtt"), null, true, false)).toBe("Tick both statements to upload.");
    expect(uploadError(file("a.vtt"), null, false, true)).toBe("Tick both statements to upload.");
    expect(uploadError(null, file("a.wav"), true, true)).toBeNull();
  });

  it("explains why the recording picker is disabled", () => {
    expect(recordingDisabledReason({ recording_block_reason: "not_permitted", jurisdiction: "US-CA", recording_consent: "granted" })).toBe(
      "Recording isn't permitted for US-CA",
    );
    expect(recordingDisabledReason({ recording_block_reason: "missing_consent", jurisdiction: "IN", recording_consent: "refused" })).toBe(
      "The candidate hasn't agreed to recording",
    );
    expect(recordingDisabledReason({ recording_block_reason: null, jurisdiction: "IN", recording_consent: "granted" })).toBeNull();
  });

  it("plays from the answer's timestamp", () => {
    expect(playbackAt("/api/v1/files/f/download", 14500)).toBe("/api/v1/files/f/download#t=14");
    expect(playbackAt("/api/v1/files/f/download", null)).toBe("/api/v1/files/f/download");
    expect(formatTimestamp(65000)).toBe("01:05");
  });

  it("labels consent chips and statuses", () => {
    expect(callChip("granted")).toBe("Call: Agreed");
    expect(recordingChip({ recording_consent: "pending", recording_rule: "not_permitted", jurisdiction: "US" })).toBe("Recording: Not permitted (US)");
    expect(recordingChip({ recording_consent: "refused", recording_rule: "candidate_consent", jurisdiction: "IN" })).toBe("Recording: Refused");
    expect(STATUS_LABELS.consent_pending).toBe("Waiting for consent");
    expect(STATUS_LABELS.ready_for_review).toBe("Ready for review");
  });

  it("validates the consent page country", () => {
    expect(consentError("")).toBe("Tell us which country you are in.");
    expect(consentError("IN")).toBeNull();
  });

  it("groups unlabelled transcript lines into speakers", () => {
    const groups = speakerGroups([
      { seq: 1, text: "Are you interested?", speaker_role: "unknown" },
      { seq: 2, text: "Yes.", speaker_role: "unknown" },
      { seq: 3, text: "Notice?", speaker_role: "unknown" },
    ]);
    expect(groups.map((g) => g.seqs)).toEqual([[1, 3], [2]]);
  });
});
