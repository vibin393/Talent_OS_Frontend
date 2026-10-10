import { afterEach, describe, expect, it, vi } from "vitest";
import { credentialForm, workCredentialsApi } from "./api";
import {
  aadhaarLast4Error,
  type CanvasLike,
  clampBox,
  credentialBadge,
  flattenRedacted,
  hasErrors,
  itemBadge,
  moveBox,
  numberError,
  validateRequirement,
  waiveReasonError,
} from "./logic";
import type { RequirementIn } from "./types";

const PKG = "3f6c1f0e-8a7b-4c2d-9e1f-0a1b2c3d4e5f";

function fakeCanvas(log: string[]): (w: number, h: number) => CanvasLike {
  return (w, h) => {
    const ctx = {
      fillStyle: "" as string,
      drawImage: (_img: unknown, x: number, y: number, dw: number, dh: number) => log.push(`draw ${x},${y},${dw},${dh}`),
      fillRect: (x: number, y: number, rw: number, rh: number) => log.push(`fill ${x},${y},${rw},${rh}`),
    };
    return {
      width: w,
      height: h,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void, type?: string) => {
        log.push(`encode ${type}`);
        cb(new Blob(["flattened"], { type: type ?? "image/png" }));
      },
    } as CanvasLike;
  };
}

describe("AadhaarCapture logic", () => {
  it("validates the last 4 digits and refuses a full number", () => {
    expect(aadhaarLast4Error("0124")).toBeNull();
    expect(aadhaarLast4Error("124")).toMatch(/exactly/);
    expect(aadhaarLast4Error("2345 6789 0124")).toMatch(/Never/);
  });

  it("flattening paints every box and produces a new JPEG blob", async () => {
    const log: string[] = [];
    const original = new Blob(["original-with-exif"], { type: "image/jpeg" });
    const out = await flattenRedacted({}, { width: 400, height: 250 }, [{ x: 10, y: 150, w: 200, h: 30 }, { x: 0, y: 0, w: 20, h: 20 }], fakeCanvas(log));
    expect(out).not.toBe(original);
    expect(out.type).toBe("image/jpeg");
    expect(await out.text()).toBe("flattened");
    expect(log).toEqual(["draw 0,0,400,250", "fill 10,150,200,30", "fill 0,0,20,20", "encode image/jpeg"]);
  });

  it("refuses to flatten without a redaction box", async () => {
    await expect(flattenRedacted({}, { width: 10, height: 10 }, [], fakeCanvas([]))).rejects.toThrow(/Cover/);
  });

  it("moves and resizes boxes with the keyboard inside the image", () => {
    const b = { x: 0, y: 0, w: 50, h: 20 };
    expect(moveBox(b, "ArrowRight", false, 100, 100)).toEqual({ x: 8, y: 0, w: 50, h: 20 });
    expect(moveBox(b, "ArrowLeft", false, 100, 100)).toEqual({ x: 0, y: 0, w: 50, h: 20 });
    expect(moveBox(b, "ArrowRight", true, 100, 100)).toEqual({ x: 0, y: 0, w: 58, h: 20 });
    expect(moveBox(b, "Enter", false, 100, 100)).toBeNull();
    expect(clampBox({ x: 90, y: 90, w: 50, h: 50 }, 100, 100)).toEqual({ x: 50, y: 50, w: 50, h: 50 });
  });
});

describe("upload never carries the original", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts only the flattened blob and the last 4 digits", async () => {
    const calls: { url: string; body: FormData }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: init.body as FormData });
        return new Response(JSON.stringify({ id: "c1" }), { status: 201, headers: { "Content-Type": "application/json" } });
      }),
    );
    const flattened = new Blob(["flattened"], { type: "image/jpeg" });
    await workCredentialsApi.record({ type_key: "aadhaar", number: "0124", file: flattened, filename: "aadhaar-redacted.jpg" });
    expect(calls).toHaveLength(1);
    const form = calls[0].body;
    expect(calls[0].url).toContain("/api/v1/portal/work/credentials");
    expect(form.get("number")).toBe("0124");
    const files = form.getAll("file");
    expect(files).toHaveLength(1);
    expect(await (files[0] as Blob).text()).toBe("flattened");
    expect([...form.keys()].sort()).toEqual(["file", "number", "type_key"]);
  });

  it("builds forms without empty fields", () => {
    const f = credentialForm({ type_key: "passport", number: "K1234567", issuer: "", expires_on: "2030-01-01" });
    expect([...f.keys()].sort()).toEqual(["expires_on", "number", "type_key"]);
  });
});

describe("badge mapping", () => {
  it("maps credential and checklist statuses", () => {
    expect(credentialBadge("expiring_soon")).toEqual({ label: "Expiring soon", color: "warning" });
    expect(credentialBadge("expired").color).toBe("danger");
    expect(credentialBadge("valid").color).toBe("success");
    expect(credentialBadge("weird_state").label).toBe("weird state");
    expect(itemBadge("waived").color).toBe("subtle");
    expect(itemBadge("missing").color).toBe("danger");
  });

  it("validates numbers per kind", () => {
    expect(numberError("encrypted", "passport", "K1234567")).toBeNull();
    expect(numberError("encrypted", "passport", "1234567")).toMatch(/passport/);
    expect(numberError("encrypted", "pan_card", "ABCDE1234F")).toBeNull();
    expect(numberError("encrypted", "visa", "2345 6789 0124")).toMatch(/Aadhaar/);
    expect(numberError("none", "insurance", "")).toBeNull();
  });
});

describe("requirement editor validation", () => {
  const base: RequirementIn = {
    name: "Banking",
    client_id: null,
    match: { role_keywords: [], industries: ["Banking"], countries: [], worker_types: [], engagement_kinds: [] },
    items: [
      { kind: "credential", ref: "pan_card", mandatory: true, label: "PAN card" },
      { kind: "bgv_package", ref: PKG, mandatory: true, label: "Package B" },
    ],
    active: true,
    effective_from: null,
  };

  it("accepts a valid requirement", () => {
    expect(hasErrors(validateRequirement(base))).toBe(false);
  });

  it("flags missing name, empty items, duplicates and bad refs", () => {
    expect(validateRequirement({ ...base, name: " " }).name).toBeDefined();
    expect(validateRequirement({ ...base, items: [] }).items).toBeDefined();
    const dup = validateRequirement({ ...base, items: [base.items[0], { ...base.items[0] }] });
    expect(dup.itemErrors[1]).toMatch(/already/);
    const bad = validateRequirement({ ...base, items: [{ kind: "policy_ack", ref: "nda", mandatory: true, label: "NDA" }] });
    expect(bad.itemErrors[0]).toMatch(/Pick/);
  });

  it("requires a 10-character waive reason", () => {
    expect(waiveReasonError("short")).not.toBeNull();
    expect(waiveReasonError("Client confirmed in writing")).toBeNull();
  });
});
