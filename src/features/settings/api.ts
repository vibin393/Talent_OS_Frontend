import { api } from "@/lib/api/client";
import type {
  CompanySettingsUpdate,
  IdPrefixesUpdate,
  LinkExpiriesUpdate,
  RegionalSettingsUpdate,
  SettingsSectionsOut,
} from "@/lib/api/types";

import type { SettingsRegistryEntry } from "./catalog";

const S = "/api/v1/settings";

export const settingsApi = {
  catalog: (signal?: AbortSignal) => api.get<SettingsRegistryEntry[]>(S, { signal }),
  sections: (signal?: AbortSignal) => api.get<SettingsSectionsOut>(`${S}/sections`, { signal }),
  company: (body: CompanySettingsUpdate) => api.patch<Record<string, unknown>>(`${S}/company`, body),
  regional: (body: RegionalSettingsUpdate) => api.patch<Record<string, unknown>>(`${S}/regional`, body),
  idPrefixes: (body: IdPrefixesUpdate) => api.patch<Record<string, unknown>>(`${S}/id-prefixes`, body),
  linkExpiries: (body: LinkExpiriesUpdate) => api.patch<Record<string, unknown>>(`${S}/link-expiries`, body),
};

export const settingsKeys = {
  all: ["settings"] as const,
  catalog: ["settings", "catalog"] as const,
  sections: ["settings", "sections"] as const,
};
