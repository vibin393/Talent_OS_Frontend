import { describe, expect, it } from "vitest";
import { articleFromGap, AUDIENCE_LABELS, canPublish, GAP_OUTCOMES, KIND_LABELS, publishableVersion, STATUS_LABELS } from "./logic";
import type { SourceDetailOut, VersionOut } from "./types";

const version = (no: number, over: Partial<VersionOut> = {}): VersionOut => ({
  id: `v${no}`, version_no: no, body_md: "# FAQ", file_id: null, extract_status: "ok", extracted_chars: 0, chunk_count: 1,
  published: false, created_by: null, created_at: "2026-10-10T00:00:00Z", ...over,
});

const source = (over: Partial<SourceDetailOut> = {}): SourceDetailOut => ({
  id: "s", title: "IT FAQ", kind: "article", audience: "both", status: "draft", current_version_no: 2, published_version_no: null,
  ref_kind: null, ref_id: null, legal_entity_id: null, client_id: null, owner_id: null, tags: [], last_reviewed_on: null,
  created_at: "", updated_at: "", current_body_md: "# FAQ", versions: [version(2), version(1)], ...over,
});

describe("knowledge sources", () => {
  it("uses the spec labels", () => {
    expect(KIND_LABELS.policy_document).toBe("Policy");
    expect(AUDIENCE_LABELS.both).toBe("Workers and candidates");
    expect(STATUS_LABELS.unpublished).toBe("Unpublished");
    expect(GAP_OUTCOMES.ungrounded).toBe("No source found");
  });

  it("publishes the newest readable version (publish flow)", () => {
    expect(publishableVersion(source())).toBe(2);
    expect(canPublish(source())).toBe(true);
    expect(canPublish(source({ status: "published", published_version_no: 2 }))).toBe(false);
    expect(canPublish(source({ status: "archived" }))).toBe(false);
    const unreadable = source({ versions: [version(1, { body_md: null, extract_status: "unsupported" })] });
    expect(publishableVersion(unreadable)).toBeNull();
    expect(canPublish(unreadable)).toBe(false);
  });

  it("prefills an article from an FAQ gap", () => {
    const a = articleFromGap({ question: "When is my first salary credited?", topic: "pay", times_asked: 3, outcome: "handed_off", last_asked: "", thread_ids: [] });
    expect(a.title).toBe("When is my first salary credited");
    expect(a.body_md.startsWith("# When is my first salary credited")).toBe(true);
  });
});
