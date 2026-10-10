import type { Metadata } from "next";
import { SettingsHub } from "@/features/settings/settings-hub";

export const metadata: Metadata = { title: "Settings" };

export default async function Page({ searchParams }: PageProps<"/admin/settings">) {
  const { tab } = await searchParams;
  return <SettingsHub initialTab={typeof tab === "string" ? tab : undefined} />;
}
