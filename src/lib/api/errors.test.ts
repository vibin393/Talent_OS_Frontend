import { describe, expect, it } from "vitest";
import { ApiError, errorMessage, fieldErrors, isApiError, toApiError } from "./errors";

describe("toApiError", () => {
  it("parses the error envelope", () => {
    const e = toApiError(401, {
      error: { code: "account_locked", message: "Locked", details: { locked_until: "2026-09-30T10:00:00Z" } },
    });
    expect(e).toBeInstanceOf(ApiError);
    expect(isApiError(e)).toBe(true);
    expect(e.status).toBe(401);
    expect(e.code).toBe("account_locked");
    expect(e.message).toBe("Locked");
    expect(e.details.locked_until).toBe("2026-09-30T10:00:00Z");
  });

  it("falls back for missing or malformed bodies", () => {
    expect(toApiError(500, null)).toMatchObject({ status: 500, code: "internal_error", details: {} });
    expect(toApiError(404, "nope")).toMatchObject({ status: 404, code: "http_error" });
    expect(toApiError(400, { error: { code: 1, details: [] } })).toMatchObject({
      code: "http_error",
      message: "Request failed with 400",
      details: {},
    });
  });
});

describe("fieldErrors", () => {
  const err = (fields: unknown) => new ApiError(422, "validation_failed", "x", { fields });

  it("maps list items by the last dotted segment", () => {
    expect(
      fieldErrors(
        err([
          { field: "body.password", message: "Too short", type: "string_too_short" },
          { field: "body.email", message: "Bad email", type: "value_error" },
          { field: "body.password", message: "Second", type: "x" },
        ]),
      ),
    ).toEqual({ password: "Too short", email: "Bad email" });
  });

  it("maps weak_password items without a body prefix", () => {
    expect(fieldErrors(err([{ field: "password", message: "Too common", type: "weak_password" }]))).toEqual({
      password: "Too common",
    });
  });

  it("tolerates the dict form", () => {
    expect(fieldErrors(err({ password: "Too short", name: ["Required"] }))).toEqual({
      password: "Too short",
      name: "Required",
    });
  });

  it("ignores non-ApiErrors and junk", () => {
    expect(fieldErrors(new Error("x"))).toEqual({});
    expect(fieldErrors(err([null, { message: "no field" }]))).toEqual({});
  });
});

describe("errorMessage", () => {
  it("uses friendly text for network and server errors", () => {
    expect(errorMessage(new ApiError(0, "network_error", "x"))).toMatch(/Cannot reach the server/);
    expect(errorMessage(new ApiError(503, "internal_error", "boom"), "fallback")).toBe("fallback");
    expect(errorMessage(new ApiError(409, "conflict", "Taken"))).toBe("Taken");
  });
});
