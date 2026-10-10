import { redirect } from "next/navigation";

/** Legacy agent-panel links (`/ai/runs/{id}`) open the governance run detail. */
export default async function Page({ params }: PageProps<"/ai/runs/[id]">) {
  const { id } = await params;
  redirect(`/admin/ai/runs/${encodeURIComponent(id)}`);
}
