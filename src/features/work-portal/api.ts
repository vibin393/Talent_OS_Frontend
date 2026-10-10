/** Worker "My Work" placement / profile / bank calls (candidate session via `portalRequest`). */
import { portalRequest } from "@/lib/api/portal-client";
import type { BankAccountIn, PortalPlacementOut, PortalProfileOut, PortalProfileUpdate } from "@/features/placements/types";

const W = "/api/v1/portal/work";
const enc = encodeURIComponent;

export type PortalBankAccount = {
  id: string;
  holder_name: string | null;
  account_number_last4: string | null;
  ifsc: string;
  bank_name: string | null;
  status: "pending_approval" | "active" | "rejected";
  created_at: string;
};

export const workPortalApi = {
  placements: (signal?: AbortSignal) => portalRequest<PortalPlacementOut[]>(`${W}/placements`, { signal }),
  confirmJoining: (id: string) => portalRequest<PortalPlacementOut>(`${W}/placements/${enc(id)}/confirm-joining`, { method: "POST" }),
  profile: (signal?: AbortSignal) => portalRequest<PortalProfileOut>(`${W}/profile`, { signal }),
  updateProfile: (body: PortalProfileUpdate) => portalRequest<PortalProfileOut>(`${W}/profile`, { method: "PATCH", body }),
  bankAccounts: (signal?: AbortSignal) => portalRequest<PortalBankAccount[]>(`${W}/bank-accounts`, { signal }),
  requestBankChange: (body: BankAccountIn) => portalRequest<PortalBankAccount>(`${W}/bank-accounts`, { method: "POST", body }),
};

export const workPortalKeys = {
  placements: ["portal", "work", "placements"] as const,
  profile: ["portal", "work", "profile"] as const,
  bank: ["portal", "work", "bank"] as const,
};
