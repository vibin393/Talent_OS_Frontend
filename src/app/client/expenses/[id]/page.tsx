import { ClientClaimDetailView } from "@/features/expenses/client-claim-detail";

export default async function Page({ params }: PageProps<"/client/expenses/[id]">) {
  const { id } = await params;
  return <ClientClaimDetailView key={id} id={id} />;
}
