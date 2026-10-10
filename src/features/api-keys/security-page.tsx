"use client";

import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { SecurityView } from "@/features/admin/security-view";
import { usePermission } from "@/features/auth/use-permission";
import { ApiKeysSection } from "./api-keys-section";

/** `/admin/security`: tenant sign-in requirements (story 1.4) plus API keys (Epic 12 story 12.7). */
export function SecurityPage() {
  const canRead = usePermission("settings:read");
  const canKeys = usePermission("api_key:manage");
  if (!canRead && !canKeys) return <NoAccess what="security settings" />;
  return (
    <>
      {canRead ? <SecurityView /> : <PageHeader title="Security" subtitle="API keys for integrations." />}
      <ApiKeysSection />
    </>
  );
}
