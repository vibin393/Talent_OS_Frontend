"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "@/features/admin/api";
import { EMPTY_USER_FILTERS } from "@/features/admin/query";
import { usePermission } from "@/features/auth/use-permission";

export type Person = { id: string; name: string; secondary?: string | null };

/** Teams whose members are loaded for the team-based directory (one request per team). */
const MAX_DIRECTORY_TEAMS = 25;

/**
 * Case/diacritic-insensitive match of `q`: anywhere in the name, or at the start of the secondary text
 * (email / team), so "@co" finds "Cora" but not everyone whose email ends in ".com".
 */
export function matchesPerson(p: Person, q: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
  const needle = norm(q.trim());
  if (!needle) return true;
  return norm(p.name).includes(needle) || (!!p.secondary && norm(p.secondary).startsWith(needle));
}

/**
 * People the signed-in user may pick (mentions, owners). There is no general user directory API, so:
 * with `user:read` the admin user search is used (server-side `q`); otherwise, with `team:read`, the
 * members of the tenant's teams are loaded once and filtered locally. Without either, `available` is false.
 */
export function usePeopleSearch(query: string, enabled: boolean) {
  const canReadUsers = usePermission("user:read");
  const canReadTeams = usePermission("team:read");
  const q = query.trim();

  const users = useQuery({
    queryKey: [...adminKeys.userSearch(q), true],
    queryFn: ({ signal }) => adminApi.listUsers({ ...EMPTY_USER_FILTERS, q, status: "active" }, 1, 20, signal),
    enabled: enabled && canReadUsers,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const teamMembers = useQuery({
    queryKey: [...adminKeys.teams, "directory"],
    queryFn: async ({ signal }) => {
      const teams = await adminApi.listTeams(1, LOOKUP_PAGE_SIZE, signal);
      const details = await Promise.all(
        teams.items.slice(0, MAX_DIRECTORY_TEAMS).map((t) => adminApi.getTeam(t.id, signal)),
      );
      const people = new Map<string, Person>();
      for (const team of details) {
        for (const m of team.members) {
          if (m.is_active === false) continue;
          const existing = people.get(m.user_id);
          people.set(m.user_id, {
            id: m.user_id,
            name: m.name,
            secondary: existing?.secondary ?? m.email ?? team.name,
          });
        }
      }
      return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: enabled && !canReadUsers && canReadTeams,
    staleTime: 5 * 60_000,
  });

  if (canReadUsers) {
    return {
      available: true,
      loading: users.isFetching,
      // Filtered locally too, so the previous page shown while a new search loads never offers a non-match.
      people: (users.data?.items ?? [])
        .map<Person>((u) => ({ id: u.id, name: u.name || u.email, secondary: u.email }))
        .filter((p) => matchesPerson(p, q)),
    };
  }
  if (canReadTeams) {
    return {
      available: true,
      loading: teamMembers.isFetching,
      people: (teamMembers.data ?? []).filter((p) => matchesPerson(p, q)).slice(0, 20),
    };
  }
  return { available: false, loading: false, people: [] as Person[] };
}
