import { PageHeader } from "@/components/app-shell/page-header";
import { VendorPortalUsersPanel } from "@/features/vendor-access/vendor-portal-users-panel";

/** Vendor self-administration (vendor admins; others see Access Denied). */
export default function VendorUsersPage() {
  return (
    <>
      <PageHeader title="Users" subtitle="Colleagues who can use the vendor portal" />
      <VendorPortalUsersPanel />
    </>
  );
}
