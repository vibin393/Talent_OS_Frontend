import { ClientCompare } from "@/features/client-portal/client-submissions";

/** Client Portal: side-by-side candidate comparison (Epic 18). */
export default async function Page({ searchParams }: PageProps<"/client/compare">) {
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).split(",").filter(Boolean);
  return <ClientCompare ids={ids} />;
}
