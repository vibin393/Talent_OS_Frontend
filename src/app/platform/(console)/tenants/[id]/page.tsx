import type { Metadata } from "next";
import { TenantDetail } from "@/features/platform/tenant-detail";

export const metadata: Metadata = { title: "Tenant" };

export default async function Page({ params }: PageProps<"/platform/tenants/[id]">) {
  const { id } = await params;
  return <TenantDetail key={id} id={id} />;
}
