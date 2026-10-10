import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { candidateComposeContext, demandComposeContext } from "./compose-contexts";
import {
  addressRecipient,
  bouncedSet,
  buildSendBody,
  type ComposeDraft,
  draftKey,
  emptyDraft,
  entityRecipient,
  fromLine,
  isBounced,
  knownAddresses,
  loadDraft,
  needsOverwriteConfirm,
  saveDraft,
  templateKeysFor,
  validateDraft,
} from "./compose-model";
import { chipsToTokens, isEmptyHtml, tokenPaths, tokensToChips, unknownPaths } from "./merge-tokens";
import { mergeFieldError } from "./template-keys";

describe("merge chips", () => {
  it("round-trips tokens through editor chips", () => {
    const html = "<p>Hi {{ candidate.first_name }}, welcome to {{client.name}}!</p>";
    const chips = tokensToChips(html);
    expect(chips).toContain('<span data-merge-field="candidate.first_name">{{ candidate.first_name }}</span>');
    expect(chips).toContain('<span data-merge-field="client.name">{{ client.name }}</span>');
    expect(chipsToTokens(chips)).toBe("<p>Hi {{ candidate.first_name }}, welcome to {{ client.name }}!</p>");
  });

  it("reads chips as Tiptap serialises them (extra attributes)", () => {
    const editor =
      '<p>Dear <span data-merge-field="contact.first_name" data-invalid="true" contenteditable="false">{{ contact.first_name }}</span></p>';
    expect(chipsToTokens(editor)).toBe("<p>Dear {{ contact.first_name }}</p>");
  });

  it("leaves tokens inside attributes alone", () => {
    const html = '<p><a href="{{ link.url }}">Open {{ link.url }}</a></p>';
    const chips = tokensToChips(html);
    expect(chips).toContain('href="{{ link.url }}"');
    expect(chipsToTokens(chips)).toBe('<p><a href="{{ link.url }}">Open {{ link.url }}</a></p>');
  });

  it("lists used and unknown paths", () => {
    const text = "{{ candidate.salary }} {{ candidate.first_name }} {{candidate.salary}}";
    expect(tokenPaths(text)).toEqual(["candidate.salary", "candidate.first_name"]);
    expect(unknownPaths(text, ["candidate.first_name"])).toEqual(["candidate.salary"]);
  });

  it("treats an empty Tiptap document as empty", () => {
    expect(isEmptyHtml("<p></p>")).toBe(true);
    expect(isEmptyHtml("<p> </p><p><br></p>")).toBe(true);
    expect(isEmptyHtml("<p>x</p>")).toBe(false);
  });
});

describe("compose: template overwrite confirmation", () => {
  const base: ComposeDraft = emptyDraft({ initialTo: [] });

  it("does not ask on an empty message", () => {
    expect(needsOverwriteConfirm(base)).toBe(false);
  });

  it("does not ask when the message is the untouched previous template", () => {
    const d = { ...base, subject: "Invite", bodyHtml: "<p>Hi</p>", pristine: { subject: "Invite", bodyHtml: "<p>Hi</p>" } };
    expect(needsOverwriteConfirm(d)).toBe(false);
  });

  it("asks when the user edited the subject or body", () => {
    expect(needsOverwriteConfirm({ ...base, subject: "My own subject" })).toBe(true);
    const edited = {
      ...base,
      subject: "Invite",
      bodyHtml: "<p>Hi there</p>",
      pristine: { subject: "Invite", bodyHtml: "<p>Hi</p>" },
    };
    expect(needsOverwriteConfirm(edited)).toBe(true);
  });
});

describe("compose: bounced recipients", () => {
  const statuses = [
    { address: "Bounce@Example.com", hard_bounced_at: "2026-09-01T00:00:00Z", last_bounce_reason: "550", marketing_opt_out: false },
    { address: "ok@example.com", hard_bounced_at: null, last_bounce_reason: null, marketing_opt_out: false },
  ];

  it("flags hard-bounced addresses case-insensitively", () => {
    const bounced = bouncedSet(statuses);
    expect(isBounced(addressRecipient("bounce@example.com"), bounced)).toBe(true);
    expect(isBounced(entityRecipient("candidate", "c1", "Priya", "BOUNCE@example.com"), bounced)).toBe(true);
    expect(isBounced(addressRecipient("ok@example.com"), bounced)).toBe(false);
    expect(isBounced(entityRecipient("contact", "k1", "No mail", null), bounced)).toBe(false);
  });

  it("checks each known address once", () => {
    expect(
      knownAddresses([addressRecipient("B@x.io"), entityRecipient("candidate", "c", "C", "b@x.io"), addressRecipient("nope")]),
    ).toEqual(["b@x.io"]);
  });
});

describe("compose: drafts, validation and send body", () => {
  it("keeps drafts per entity and survives a broken storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    const key = draftKey({ entityType: "candidate", entityId: "c1" });
    const draft = { ...emptyDraft({ initialTo: [] }), subject: "Hello" };
    saveDraft(key, draft, storage);
    expect(loadDraft(key, storage)?.subject).toBe("Hello");
    expect(loadDraft(draftKey({ entityType: "candidate", entityId: "c2" }), storage)).toBeNull();
    const deny = () => {
      throw new Error("denied");
    };
    const throwing = { getItem: deny, setItem: deny, removeItem: deny };
    expect(() => saveDraft(key, draft, throwing)).not.toThrow();
    expect(loadDraft(key, throwing)).toBeNull();
    store.set(key, "{not json");
    expect(loadDraft(key, storage)).toBeNull();
  });

  it("validates recipients, subject and body", () => {
    const d = emptyDraft({ initialTo: [] });
    expect(Object.keys(validateDraft(d)).sort()).toEqual(["body", "subject", "to"]);
    const ok = { ...d, to: [addressRecipient("a@b.co")], subject: "S", bodyHtml: "<p>x</p>" };
    expect(validateDraft(ok)).toEqual({});
    expect(validateDraft({ ...ok, to: [addressRecipient("nope")] }).to).toBeDefined();
  });

  it("sends entities by reference and addresses as addresses", () => {
    const ctx = candidateComposeContext({ id: "c1", full_name: "Priya Sharma", human_id: "CAN-1", primary_email: "p@x.io" });
    const d = {
      ...emptyDraft(ctx),
      cc: [addressRecipient("boss@x.io")],
      subject: " Hi ",
      bodyHtml: "<p>Hello</p>",
      templateVariantId: "v1",
    };
    const body = buildSendBody(d, ctx);
    expect(body.to).toEqual([{ entity_type: "candidate", entity_id: "c1" }]);
    expect(body.cc).toEqual([{ address: "boss@x.io" }]);
    expect(body.subject).toBe("Hi");
    expect(body.template_variant_id).toBe("v1");
    expect(body.context_refs).toEqual({ candidate_id: "c1" });
    expect(body.related).toEqual([{ entity_type: "candidate", entity_id: "c1" }]);
  });

  it("pre-fills the demand's hiring manager and skips contacts without email", () => {
    const ctx = demandComposeContext(
      { id: "d1", req_id: "REQ-1", title: "Engineer", client_id: "k", hiring_manager_contact_id: "hm" },
      [
        { id: "hm", name: "Hiring Manager", email: "hm@k.io", archived_at: null },
        { id: "x", name: "No email", email: null, archived_at: null },
        { id: "old", name: "Archived", email: "old@k.io", archived_at: "2026-01-01T00:00:00Z" },
      ],
    );
    expect(ctx.initialTo.map((r) => r.entityId)).toEqual(["hm"]);
    expect(ctx.suggested.map((r) => r.entityId)).toEqual(["hm"]);
    expect(templateKeysFor(ctx.entityType)).toContain("submission");
    expect(templateKeysFor("candidate")).toContain("interview_invite");
  });

  it("describes the From line", () => {
    expect(fromLine("me@acme.com", [])).toBe("Talent OS on behalf of you — replies go to me@acme.com");
    expect(
      fromLine("me@acme.com", [
        {
          id: "1",
          provider: "microsoft",
          account_email: "me@acme.com",
          scopes: [],
          status: "active",
          connected_at: "",
          expires_at: null,
          last_error: null,
        },
      ]),
    ).toBe("me@acme.com (Microsoft 365)");
  });
});

describe("template errors", () => {
  it("reads unknown merge fields from a 422", () => {
    const e = new ApiError(422, "unknown_merge_field", "bad", { fields: ["candidate.salary"] });
    expect(mergeFieldError(e)).toEqual({ code: "unknown_merge_field", fields: ["candidate.salary"] });
    expect(mergeFieldError(new ApiError(422, "malformed_merge_token", "bad"))).toEqual({
      code: "malformed_merge_token",
      fields: [],
    });
    expect(mergeFieldError(new ApiError(409, "template_system", "no"))).toBeNull();
  });
});
