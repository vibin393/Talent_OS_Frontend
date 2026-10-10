/** Display helpers for the public Job Network site (Epic 75, B1). */
import type { NetworkJobSummary } from "@/lib/api/network";

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? "" : "s"} ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? "" : "s"} ago`;
}

const PERIOD: Record<string, string> = { year: "/yr", month: "/mo", day: "/day", hour: "/hr" };

export function payLabel(j: Pick<NetworkJobSummary, "pay_min" | "pay_max" | "pay_currency" | "pay_period">): string | null {
  if (!j.pay_min && !j.pay_max) return null;
  const cur = j.pay_currency ?? "";
  const fmt = (v: string | null) => (v ? Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "");
  const range = j.pay_min && j.pay_max ? `${fmt(j.pay_min)}–${fmt(j.pay_max)}` : fmt(j.pay_min ?? j.pay_max);
  return `${cur} ${range}${PERIOD[j.pay_period ?? ""] ?? ""}`.trim();
}

export function locationLabel(j: Pick<NetworkJobSummary, "city" | "region" | "country" | "location_hidden" | "work_mode">): string {
  if (j.work_mode === "remote") return "Remote";
  if (j.location_hidden) return "Location on request";
  return [j.city, j.region, j.country].filter(Boolean).join(", ") || "Location on request";
}

export const WORK_MODE_LABELS: Record<string, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };
export const EMPLOYMENT_LABELS: Record<string, string> = {
  permanent: "Permanent",
  contract: "Contract",
  contract_to_hire: "Contract to hire",
  freelance: "Freelance",
};
export const POSTED_WITHIN_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];
