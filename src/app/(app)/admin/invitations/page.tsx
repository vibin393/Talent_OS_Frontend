import type { Metadata } from "next";
import { InvitationsView } from "@/features/admin/invitations-view";

export const metadata: Metadata = { title: "Pending invitations" };

export default function Page() {
  return <InvitationsView />;
}
