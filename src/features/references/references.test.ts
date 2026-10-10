import { describe, expect, it } from "vitest";
import { emptyReferee, hasErrors, normalisePhone, validateReferees, validateReferenceAnswers } from "./logic";

describe("referee form validation", () => {
  const ref = (email: string, phone = "") => ({ ...emptyReferee(), name: "Meera Manager", email, phone });
  it("refuses the candidate's own email, duplicates and short lists", () => {
    const own = validateReferees([ref("me@example.com")], "Me@Example.com", 1);
    expect(own.errors[0].email).toMatch(/own referee/);
    const dup = validateReferees([ref("a@ref.example.com"), ref("A@ref.example.com")], null, 2);
    expect(dup.errors[1].email).toMatch(/already/);
    const short = validateReferees([ref("a@ref.example.com")], null, 2);
    expect(short.form).toMatch(/at least 2/);
    expect(hasErrors(validateReferees([ref("a@ref.example.com"), ref("b@ref.example.com", "98450 12345")], null, 2))).toBe(false);
  });
  it("normalises phones to E.164", () => {
    expect(normalisePhone("98450 12345")).toBe("+919845012345");
    expect(normalisePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("12345")).toBeUndefined();
  });
});

describe("public reference questionnaire (purpose reference_check)", () => {
  const questions = [
    { key: "role", text: "Role?", kind: "text" as const, required: true },
    { key: "performance", text: "Rating?", kind: "rating" as const, required: true },
    { key: "rehire", text: "Rehire?", kind: "yes_no" as const, required: false },
  ];
  it("requires answers and validates ratings / yes-no", () => {
    expect(validateReferenceAnswers(questions, {})).toEqual({ role: "Required", performance: "Required" });
    expect(validateReferenceAnswers(questions, { role: "Engineer", performance: 7, rehire: "yes" })).toEqual({
      performance: "Choose 1 to 5",
      rehire: "Answer yes or no",
    });
    expect(validateReferenceAnswers(questions, { role: "Engineer", performance: 5, rehire: true })).toEqual({});
  });
});
