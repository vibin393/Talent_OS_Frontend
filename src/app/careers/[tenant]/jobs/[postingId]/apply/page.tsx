import type { Metadata } from "next";
import { ApplyFlow } from "@/features/careers/apply/apply-flow";
import { loadApplyForm, loadBranding } from "@/features/careers/load";

type Props = PageProps<"/careers/[tenant]/jobs/[postingId]/apply">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant, postingId } = await params;
  const form = await loadApplyForm(tenant, postingId);
  return { title: `Apply: ${form.title}`, robots: { index: false, follow: false } };
}

/** Apply flow page (Epic 9, B3). The form (notices, questions, challenge config) is fetched server-side. */
export default async function ApplyPage({ params }: Props) {
  const { tenant, postingId } = await params;
  const [branding, form] = await Promise.all([loadBranding(tenant), loadApplyForm(tenant, postingId)]);
  return <ApplyFlow slug={tenant} orgName={branding.display_name} form={form} />;
}
