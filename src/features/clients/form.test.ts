import { describe, expect, it } from "vitest";
import type { ClientOut, ContactOut } from "@/lib/api/types";
import {
  buildClientCreate,
  buildClientUpdate,
  buildContactCreate,
  buildContactUpdate,
  clientDraft,
  contactDraft,
  mapServerFields,
  validateClientDraft,
  validateContactDraft,
} from "./form";

const client: ClientOut = {
  id: "c1",
  name: "Acme",
  industry: "Software",
  website: "https://acme.com",
  locations: [{ city: "Pune", state: null, country: "India" }],
  gstin: null,
  owner: { id: "u1", name: "Ann" },
  owner_id: "u1",
  status: "active",
  archived_at: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const contact: ContactOut = {
  id: "k1",
  client_id: "c1",
  name: "Bob",
  title: null,
  email: "bob@acme.com",
  phone: "+919876543210",
  type: "hr",
  archived_at: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

describe("client drafts", () => {
  it("creates a trimmed body with blanks as null and upper-cased GSTIN", () => {
    const d = { ...clientDraft(), name: " Globex ", industry: " ", gstin: "22aaaaa0000a1z5", ownerId: "u2" };
    expect(buildClientCreate(d)).toEqual({
      name: "Globex",
      status: "prospect",
      industry: null,
      website: null,
      gstin: "22AAAAA0000A1Z5",
      locations: [],
      owner_id: "u2",
    });
  });

  it("omits the owner when not chosen (backend defaults to the caller)", () => {
    expect(buildClientCreate({ ...clientDraft(), name: "X" })).not.toHaveProperty("owner_id");
  });

  it("sends only changed fields on update", () => {
    const d = clientDraft(client);
    expect(buildClientUpdate(client, d)).toEqual({});
    expect(buildClientUpdate(client, { ...d, industry: "", status: "inactive" })).toEqual({
      industry: null,
      status: "inactive",
    });
    expect(
      buildClientUpdate(client, { ...d, locations: [...d.locations, { city: "Austin", state: "TX", country: "USA" }] }),
    ).toEqual({
      locations: [
        { city: "Pune", state: null, country: "India" },
        { city: "Austin", state: "TX", country: "USA" },
      ],
    });
    expect(buildClientUpdate(client, { ...d, ownerId: "u9" })).toEqual({ owner_id: "u9" });
  });

  it("validates name, GSTIN and partial locations", () => {
    const errors = validateClientDraft({
      ...clientDraft(),
      name: " ",
      gstin: "12ABC",
      locations: [{ city: "Pune", state: "", country: "" }],
    });
    expect(Object.keys(errors).sort()).toEqual(["gstin", "locations.0", "name"]);
    expect(validateClientDraft({ ...clientDraft(), name: "Ok" })).toEqual({});
  });
});

describe("contact drafts", () => {
  it("builds create bodies with lower-cased email", () => {
    expect(buildContactCreate({ ...contactDraft(), name: " Eve ", email: " Eve@X.COM " })).toEqual({
      name: "Eve",
      title: null,
      email: "eve@x.com",
      phone: null,
      type: "hiring_manager",
    });
  });

  it("sends only changed contact fields", () => {
    const d = contactDraft(contact);
    expect(buildContactUpdate(contact, d)).toEqual({});
    expect(buildContactUpdate(contact, { ...d, phone: "", type: "finance" })).toEqual({ phone: null, type: "finance" });
  });

  it("validates contacts", () => {
    expect(validateContactDraft({ ...contactDraft(), name: "", email: "nope", phone: "abc" })).toEqual({
      name: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
    });
  });
});

describe("mapServerFields", () => {
  it("adds location row errors", () => {
    expect(
      mapServerFields({ city: "Required" }, [{ field: "body.locations.1.city", message: "Required", type: "missing" }]),
    ).toEqual({ city: "Required", "locations.1": "Required" });
  });
});

describe("mapServerFields prefix", () => {
  it("strips the pydantic 'Value error, ' prefix", () => {
    expect(mapServerFields({ gstin: "Value error, GSTIN must look like 22AAAAA0000A1Z5" }, [])).toEqual({
      gstin: "GSTIN must look like 22AAAAA0000A1Z5",
    });
  });
});
