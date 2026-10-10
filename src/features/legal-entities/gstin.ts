/**
 * Client-side GSTIN hints (the server is authoritative: `validate_gstin`). Mirrors the backend rules: the
 * 15-character format, the mod-36 check character, the state code (first two digits) and the PAN segment
 * (characters 3-12).
 */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function gstinCheckCharacter(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i += 1) {
    const value = ALPHABET.indexOf(first14[i]);
    const product = value * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return ALPHABET[(36 - (total % 36)) % 36];
}

/** A human hint for a (possibly partial) GSTIN, or null when it looks valid. */
export function gstinHint(raw: string, opts: { stateCode?: string | null; pan?: string | null } = {}): string | null {
  const gstin = raw.trim().toUpperCase();
  if (!gstin) return null;
  if (gstin.length !== 15) return `A GSTIN has 15 characters (${gstin.length} entered).`;
  if (!FORMAT.test(gstin)) return "This is not a valid GSTIN format.";
  if (gstinCheckCharacter(gstin.slice(0, 14)) !== gstin[14]) {
    return "The check character does not match. Check for a typo.";
  }
  if (opts.stateCode && gstin.slice(0, 2) !== opts.stateCode) {
    return `The GSTIN state code ${gstin.slice(0, 2)} does not match the chosen state (${opts.stateCode}).`;
  }
  if (opts.pan && gstin.slice(2, 12) !== opts.pan.toUpperCase()) {
    return "The PAN inside the GSTIN does not match the entity PAN.";
  }
  return null;
}

/** Indian financial year token (`26-27`) for a date. */
export function fiscalYearOf(date: Date): string {
  const y = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  const two = (n: number) => String(n % 100).padStart(2, "0");
  return `${two(y)}-${two(y + 1)}`;
}

const MISSING_LABELS: Record<string, string> = {
  pan: "PAN",
  state_code: "state",
  principal_gst_registration: "GST registration",
  gst_registration: "GST registration",
  bank_account: "default bank account",
  signatory: "authorised signatory",
};

/** "PAN, GST registration and default bank account" for the readiness banner. */
export function missingLabel(missing: readonly string[]): string {
  const labels = missing.map((m) => MISSING_LABELS[m] ?? m.replaceAll("_", " "));
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function maskAccount(last4: string): string {
  return `••••${last4}`;
}
