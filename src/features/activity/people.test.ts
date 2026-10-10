import { describe, expect, it, vi } from "vitest";

// people.ts imports React Query hooks and the admin API; only the pure matcher is under test.
vi.mock("@/features/auth/use-permission", () => ({ usePermission: () => false }));

const { matchesPerson } = await import("./people");

describe("matchesPerson", () => {
  const ada = { id: "1", name: "Ada Admin", secondary: "admin@acme.com" };
  const cora = { id: "2", name: "Cora Colleague", secondary: "cora@acme.com" };
  const jose = { id: "3", name: "José Núñez", secondary: null };

  it("matches anywhere in the name, case-insensitively", () => {
    expect(matchesPerson(cora, "co")).toBe(true);
    expect(matchesPerson(cora, "LLEAG")).toBe(true);
    expect(matchesPerson(ada, "co")).toBe(false);
  });

  it("matches the email only from its start", () => {
    expect(matchesPerson(ada, "admin@")).toBe(true);
    expect(matchesPerson(ada, "acme")).toBe(false);
  });

  it("ignores diacritics and empty queries", () => {
    expect(matchesPerson(jose, "jose nun")).toBe(true);
    expect(matchesPerson(jose, "  ")).toBe(true);
  });
});
