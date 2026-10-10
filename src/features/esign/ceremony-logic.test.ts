import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  ceremonyError,
  ceremonyStep,
  documentUrl,
  needsOtp,
  normalizeOtp,
  otpErrorMessage,
  signerProgress,
  validateSign,
} from "./ceremony-logic";

const base = { status: "sent", signer_status: "notified", your_turn: true, consented: false };

describe("ceremony step derivation", () => {
  it("consent first, then sign", () => {
    expect(ceremonyStep(base)).toBe("consent");
    expect(ceremonyStep({ ...base, consented: true })).toBe("sign");
  });
  it("waits for earlier signers", () => {
    expect(ceremonyStep({ ...base, your_turn: false })).toBe("waiting");
  });
  it("finished states", () => {
    expect(ceremonyStep({ ...base, signer_status: "signed", status: "partially_signed" })).toBe("signed");
    expect(ceremonyStep({ ...base, signer_status: "signed", status: "completed" })).toBe("completed");
    expect(ceremonyStep({ ...base, signer_status: "declined", status: "declined" })).toBe("declined");
  });
  it("closed requests", () => {
    expect(ceremonyStep({ ...base, status: "expired" })).toBe("closed");
    expect(ceremonyStep({ ...base, status: "cancelled" })).toBe("closed");
    expect(ceremonyStep({ ...base, status: "declined" })).toBe("closed");
    expect(ceremonyStep({ ...base, signer_status: "void" })).toBe("closed");
    expect(ceremonyStep(base, Date.parse("2026-10-05T00:00:00Z"), "2026-10-04T00:00:00Z")).toBe("closed");
  });
  it("needs the code only when required and not yet verified", () => {
    expect(needsOtp({ require_otp: true, otp_verified: false })).toBe(true);
    expect(needsOtp({ require_otp: true, otp_verified: true })).toBe(false);
    expect(needsOtp({ require_otp: false, otp_verified: false })).toBe(false);
  });
});

describe("sign validation", () => {
  it("requires agreement, name and a 6-digit code", () => {
    expect(validateSign({ agreed: false, typedName: " ", otp: "12" }, true)).toEqual({
      agreed: expect.any(String),
      typedName: expect.any(String),
      otp: expect.any(String),
    });
    expect(validateSign({ agreed: true, typedName: "Asha Rao", otp: "" }, false)).toEqual({});
    expect(validateSign({ agreed: true, typedName: "Asha Rao", otp: "123456" }, true)).toEqual({});
  });
  it("normalizes pasted codes", () => {
    expect(normalizeOtp("123 456")).toBe("123456");
    expect(normalizeOtp("12a3456789")).toBe("123456");
  });
});

describe("ceremony error copy", () => {
  it.each([
    ["otp_invalid", 422, "That code is not right"],
    ["otp_expired", 410, "That code has expired"],
    ["otp_locked", 429, "Too many wrong codes"],
    ["otp_rate_limited", 429, "several codes"],
  ])("%s targets the code field", (code, status, text) => {
    const err = ceremonyError(new ApiError(status, code, "server"));
    expect(err.field).toBe("otp");
    expect(err.fatal).toBe(false);
    expect(err.message).toContain(text);
    expect(otpErrorMessage(new ApiError(status, code, "server"))).toBe(err.message);
  });
  it("name, consent and turn errors", () => {
    expect(ceremonyError(new ApiError(422, "name_mismatch", "")).field).toBe("typedName");
    expect(ceremonyError(new ApiError(422, "consent_required", ""))).toMatchObject({ field: "agreed", reload: true });
    expect(ceremonyError(new ApiError(409, "not_your_turn", ""))).toMatchObject({ reload: true, fatal: false });
    expect(ceremonyError(new ApiError(409, "already_signed", "")).reload).toBe(true);
  });
  it("fatal errors", () => {
    for (const code of ["document_hash_mismatch", "request_closed", "link_used", "link_expired", "link_revoked"]) {
      expect(ceremonyError(new ApiError(code === "document_hash_mismatch" ? 409 : 410, code, "")).fatal).toBe(true);
    }
    expect(ceremonyError(new ApiError(410, "something_else", "")).fatal).toBe(true);
  });
  it("network and unknown errors", () => {
    expect(ceremonyError(new ApiError(0, "network_error", "")).message).toContain("Cannot reach");
    expect(ceremonyError(new Error("boom")).message).toBe("Something went wrong. Please try again.");
    expect(otpErrorMessage(new ApiError(422, "name_mismatch", ""))).toBeNull();
  });
});

describe("ceremony helpers", () => {
  it("progress and document URL", () => {
    expect(signerProgress({ signers: [{ order: 1, name: "A", status: "signed", signed_at: null }, { order: 2, name: "B", status: "notified", signed_at: null }] })).toBe(
      "1 of 2 signed",
    );
    expect(documentUrl({ document_url: "/api/v1/x/view" }, "/fallback")).toBe("/api/v1/x/view");
    expect(documentUrl({ document_url: "https://evil.example/x" }, "/fallback")).toBe("/fallback");
  });
});
