import { redirect } from "next/navigation";

/** `/ai/proposals/{id}` opens the Proposal inbox on that Proposal. */
export default async function Page({ params }: PageProps<"/ai/proposals/[id]">) {
  const { id } = await params;
  redirect(`/proposals?id=${encodeURIComponent(id)}`);
}
