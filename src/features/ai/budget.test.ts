import { describe, expect, it } from "vitest";
import { parseAliases } from "@/features/skills/api";
import { budgetUsage } from "./budget";

describe("AI budget", () => {
  it("describes usage", () => {
    expect(budgetUsage(1100, 1000)).toEqual({ ratio: 1.1, label: "1,100 of 1,000 tokens (110%)" });
    expect(budgetUsage(5, null)).toEqual({ ratio: null, label: "No limit" });
    expect(budgetUsage(5, 0).ratio).toBeNull();
  });
});

describe("skill aliases", () => {
  it("splits, trims and de-duplicates", () => {
    expect(parseAliases("ADF, azure df,,adf\nAzure DF ")).toEqual(["ADF", "azure df"]);
    expect(parseAliases("  ")).toEqual([]);
  });
});
