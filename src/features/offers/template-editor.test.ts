import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { insertAt, mergeToken, templateFieldError, unknownFields, usedFields } from "./template";

describe("offer template editor", () => {
  it("inserts a merge field at the caret or over the selection", () => {
    expect(insertAt("Dear ,", 5, 5, mergeToken("candidate.first_name"))).toEqual({ text: "Dear {{ candidate.first_name }},", caret: 31 });
    expect(insertAt("Hello NAME!", 6, 10, "{{ x }}").text).toBe("Hello {{ x }}!");
    expect(insertAt("abc", 99, 120, "!").text).toBe("abc!");
  });

  it("finds used and unknown fields", () => {
    const body = "Hi {{ candidate.first_name }}, pay {{offer.pay_rate}} bill {{ offer.bill_rate | upper }}";
    expect(usedFields(body)).toEqual(["candidate.first_name", "offer.pay_rate", "offer.bill_rate"]);
    expect(unknownFields(body, ["candidate.first_name", "offer.pay_rate"])).toEqual(["offer.bill_rate"]);
  });

  it("shows the 422 field error inline", () => {
    expect(templateFieldError(new ApiError(422, "unknown_merge_field", "x", { field: "offer.bill_rate" }))).toBe("“offer.bill_rate” is not an allowed merge field.");
    expect(templateFieldError(new ApiError(409, "conflict", "x"))).toBeNull();
  });
});
