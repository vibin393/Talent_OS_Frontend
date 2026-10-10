import { ClientDemandDetail } from "@/features/client-portal/client-demands";

/** Client Portal: a demand and its sent candidates (Epic 18). */
export default async function Page({ params }: PageProps<"/client/demands/[id]">) {
  const { id } = await params;
  return <ClientDemandDetail key={id} id={id} />;
}
