import { describe, expect, it } from "vitest";
import { emptyKit, keyFor, toKitPayload, validateKit } from "./kit";

describe("interview kit editor", () => {
  it("derives unique keys from labels", () => {
    expect(keyFor("System design", [])).toBe("system_design");
    expect(keyFor("System design", ["system_design"])).toBe("system_design_2");
    expect(keyFor("Élan & Café", [])).toBe("elan_cafe");
    expect(keyFor("!!!", [], "competency")).toBe("competency");
  });

  it("validates name, scale and competencies", () => {
    const e = validateKit({ ...emptyKit(), ratingScale: 2, questions: [{ key: "", competencyKey: null, text: " ", guidance: "" }] });
    expect(Object.keys(e).sort()).toEqual(["competencies", "name", "question-0", "ratingScale"]);
  });

  it("builds the payload with generated keys and valid competency links", () => {
    const p = toKitPayload({
      name: " Backend ",
      description: "",
      ratingScale: 4,
      competencies: [
        { key: "", label: "Python", guidance: "" },
        { key: "", label: "Python", guidance: "idioms" },
        { key: "", label: " ", guidance: "" },
      ],
      questions: [
        { key: "", competencyKey: "python", text: "GIL?", guidance: "" },
        { key: "", competencyKey: "gone", text: "Other", guidance: "" },
      ],
    });
    expect(p.name).toBe("Backend");
    expect(p.competencies.map((c) => c.key)).toEqual(["python", "python_2"]);
    expect(p.competencies[1].guidance).toBe("idioms");
    expect(p.questions?.map((q) => [q.key, q.competency_key])).toEqual([
      ["q1", "python"],
      ["q2", null],
    ]);
  });
});
