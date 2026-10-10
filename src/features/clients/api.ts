import { api } from "@/lib/api/client";
import { pageParams } from "@/features/admin/query";
import type {
  Client360Out,
  ClientCreate,
  ClientCreatedOut,
  ClientOut,
  ClientUpdate,
  ContactCreate,
  ContactOut,
  ContactUpdate,
  Page,
} from "@/lib/api/types";
import { type ClientListFilters, type ClientSort, clientListQuery } from "./query";

const enc = encodeURIComponent;
const C = "/api/v1/clients";

export const clientsApi = {
  list: (filters: ClientListFilters, sort: ClientSort, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<ClientOut>>(`${C}?${clientListQuery(filters, sort, page, pageSize)}`, { signal }),
  create: (body: ClientCreate) => api.post<ClientCreatedOut>(C, body),
  get: (id: string, signal?: AbortSignal) => api.get<ClientOut>(`${C}/${enc(id)}`, { signal }),
  get360: (id: string, signal?: AbortSignal) => api.get<Client360Out>(`${C}/${enc(id)}/360`, { signal }),
  update: (id: string, body: ClientUpdate) => api.patch<ClientOut>(`${C}/${enc(id)}`, body),
  archive: (id: string) => api.post<ClientOut>(`${C}/${enc(id)}/archive`),
  unarchive: (id: string) => api.post<ClientOut>(`${C}/${enc(id)}/unarchive`),

  listContacts: (clientId: string, includeArchived: boolean, page: number, pageSize: number, signal?: AbortSignal) => {
    const params = pageParams(page, pageSize);
    if (includeArchived) params.set("include_archived", "true");
    return api.get<Page<ContactOut>>(`${C}/${enc(clientId)}/contacts?${params}`, { signal });
  },
  createContact: (clientId: string, body: ContactCreate) =>
    api.post<ContactOut>(`${C}/${enc(clientId)}/contacts`, body),
  updateContact: (id: string, body: ContactUpdate) => api.patch<ContactOut>(`/api/v1/contacts/${enc(id)}`, body),
  archiveContact: (id: string) => api.post<ContactOut>(`/api/v1/contacts/${enc(id)}/archive`),
  unarchiveContact: (id: string) => api.post<ContactOut>(`/api/v1/contacts/${enc(id)}/unarchive`),
};

export const clientKeys = {
  all: ["clients"] as const,
  lists: ["clients", "list"] as const,
  list: (filters: ClientListFilters, sort: ClientSort, page: number, pageSize: number) =>
    ["clients", "list", filters, sort, page, pageSize] as const,
  detail: (id: string) => ["clients", "detail", id] as const,
  contacts: (id: string) => ["clients", "detail", id, "contacts"] as const,
  contactList: (id: string, includeArchived: boolean, page: number) =>
    ["clients", "detail", id, "contacts", includeArchived, page] as const,
};
