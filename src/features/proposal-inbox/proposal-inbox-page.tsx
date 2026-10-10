"use client";

import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useMe } from "@/features/auth/use-me";
import { ProposalInbox } from "./proposal-inbox";

/** `/proposals` (`proposal:decide` or `ai:govern`): the Proposal inbox. */
export function ProposalInboxPage({ initialId = null }: { initialId?: string | null }) {
  const { data: me } = useMe();
  const decide = usePermission("proposal:decide");
  const govern = usePermission("ai:govern");
  return (
    <>
      <PageHeader title="Proposals" subtitle="Actions AI agents prepared for you. Nothing happens until a person approves it." />
      {me && !decide && !govern ? <NoAccess what="proposals" /> : <ProposalInbox scope="mine" initialId={initialId} />}
    </>
  );
}
