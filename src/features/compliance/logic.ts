// Pure helpers of the compliance feature (Epic 21): badge mapping, form validation, Aadhaar redaction geometry.

import type { CredentialStatus, ItemKind, ItemStatus, NumberKind, RequirementIn } from "./types";

export type BadgeColor = "brand" | "success" | "warning" | "danger" | "informative" | "subtle";

export const CREDENTIAL_STATUS: Record<CredentialStatus, { label: string; color: BadgeColor }> = {
  pending_verification: { label: "Pending verification", color: "informative" },
  valid: { label: "Valid", color: "success" },
  expiring_soon: { label: "Expiring soon", color: "warning" },
  expired: { label: "Expired", color: "danger" },
  rejected: { label: "Rejected", color: "danger" },
  superseded: { label: "Superseded", color: "subtle" },
};

export const ITEM_STATUS: Record<ItemStatus, { label: string; color: BadgeColor }> = {
  missing: { label: "Missing", color: "danger" },
  pending: { label: "Pending", color: "informative" },
  met: { label: "Met", color: "success" },
  expiring: { label: "Expiring", color: "warning" },
  expired: { label: "Expired", color: "danger" },
  waived: { label: "Waived", color: "subtle" },
};

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  credential: "Credential",
  document: "Document",
  bgv_package: "BGV package",
  policy_ack: "Policy acknowledgement",
};

export function credentialBadge(status: string): { label: string; color: BadgeColor } {
  return CREDENTIAL_STATUS[status as CredentialStatus] ?? { label: status.replace(/_/g, " "), color: "subtle" };
}

export function itemBadge(status: string): { label: string; color: BadgeColor } {
  return ITEM_STATUS[status as ItemStatus] ?? { label: status, color: "subtle" };
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function maskedNumber(last4: string | null | undefined): string {
  return last4 ? `•••• ${last4}` : "—";
}

/** Digits only; 12 or more digits typed into any field is treated as a full Aadhaar number. */
export function aadhaarLast4Error(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 12) return "Never enter your full Aadhaar number — only the last 4 digits.";
  if (!/^\d{4}$/.test(value.trim())) return "Enter exactly the last 4 digits.";
  return null;
}

export function looksLikeFullAadhaar(text: string): boolean {
  return /(^|\D)[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(\D|$)/.test(text);
}

export function numberError(kind: NumberKind, typeKey: string, value: string): string | null {
  const v = value.replace(/\s/g, "").toUpperCase();
  if (kind === "none") return looksLikeFullAadhaar(value) ? "Do not enter an Aadhaar number here." : null;
  if (kind === "aadhaar_last4") return aadhaarLast4Error(value);
  if (!v) return "Enter the document number.";
  if (looksLikeFullAadhaar(value)) return "Do not enter an Aadhaar number here.";
  if (typeKey === "passport" && !/^[A-Z][0-9]{7}$/.test(v)) return "An Indian passport number is 1 letter and 7 digits.";
  if (typeKey === "pan_card" && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) return "A PAN is 5 letters, 4 digits and 1 letter.";
  if (!/^[A-Z0-9]{1,30}$/.test(v)) return "Use up to 30 letters and digits.";
  return null;
}

export type RequirementErrors = Partial<Record<"name" | "items", string>> & { itemErrors: Record<number, string> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Requirement editor validation (mirrors the API: >= 1 item, unique (kind, ref), uuid refs for BGV / policy). */
export function validateRequirement(r: RequirementIn): RequirementErrors {
  const errors: RequirementErrors = { itemErrors: {} };
  if (!r.name.trim()) errors.name = "Give the requirement a name.";
  else if (looksLikeFullAadhaar(r.name)) errors.name = "Do not enter an Aadhaar number.";
  if (r.items.length === 0) errors.items = "Add at least one item.";
  const seen = new Set<string>();
  r.items.forEach((item, i) => {
    const key = `${item.kind}:${item.ref.trim()}`;
    if (!item.ref.trim()) errors.itemErrors[i] = "Pick what is required.";
    else if ((item.kind === "bgv_package" || item.kind === "policy_ack") && !UUID_RE.test(item.ref.trim()))
      errors.itemErrors[i] = "Pick a package or template.";
    else if (seen.has(key)) errors.itemErrors[i] = "This item is already listed.";
    else if (!item.label.trim()) errors.itemErrors[i] = "Give the item a label.";
    seen.add(key);
  });
  return errors;
}

export function hasErrors(e: RequirementErrors): boolean {
  return Boolean(e.name || e.items || Object.keys(e.itemErrors).length);
}

export function waiveReasonError(reason: string): string | null {
  if (reason.trim().length < 10) return "Give a reason of at least 10 characters.";
  if (looksLikeFullAadhaar(reason)) return "Do not enter an Aadhaar number.";
  return null;
}

// ---------------------------------------------------------------- Aadhaar redaction (client-side)
export type Box = { x: number; y: number; w: number; h: number };

export const MOVE_STEP = 8;

export function clampBox(b: Box, width: number, height: number): Box {
  const w = Math.max(8, Math.min(b.w, width));
  const h = Math.max(8, Math.min(b.h, height));
  return { x: Math.max(0, Math.min(b.x, width - w)), y: Math.max(0, Math.min(b.y, height - h)), w, h };
}

/** Keyboard placement: arrows move, Shift+arrows resize. Returns null for keys it does not handle. */
export function moveBox(b: Box, key: string, shift: boolean, width: number, height: number): Box | null {
  const d = MOVE_STEP;
  const delta: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
  const step = delta[key];
  if (!step) return null;
  const next = shift ? { ...b, w: b.w + step[0], h: b.h + step[1] } : { ...b, x: b.x + step[0], y: b.y + step[1] };
  return clampBox(next, width, height);
}

/** A default box over the left two thirds of the number line (where the first 8 digits print). */
export function defaultBox(width: number, height: number): Box {
  return clampBox({ x: Math.round(width * 0.2), y: Math.round(height * 0.6), w: Math.round(width * 0.4), h: Math.round(height * 0.12) }, width, height);
}

export type CanvasLike = {
  width: number;
  height: number;
  getContext(kind: "2d"): {
    drawImage(image: unknown, x: number, y: number, w: number, h: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillStyle: string | CanvasGradient | CanvasPattern;
  } | null;
  toBlob(cb: (blob: Blob | null) => void, type?: string, quality?: number): void;
};

/** Draw the image, paint opaque boxes, re-encode as JPEG (drops EXIF). The returned blob is always a new object. */
export function flattenRedacted(
  source: unknown,
  image: { width: number; height: number },
  boxes: Box[],
  createCanvas: (w: number, h: number) => CanvasLike,
): Promise<Blob> {
  if (boxes.length === 0) return Promise.reject(new Error("Cover the first 8 digits before uploading."));
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Your browser cannot redact images."));
  ctx.drawImage(source, 0, 0, image.width, image.height);
  ctx.fillStyle = "#000000";
  for (const b of boxes) ctx.fillRect(b.x, b.y, b.w, b.h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the image."))), "image/jpeg", 0.9),
  );
}
