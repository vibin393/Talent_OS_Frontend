"use client";

import { ExternalPortalFrame } from "@/features/external-portal/portal-frame";
import { PortalCopilot } from "@/features/portal-copilot/portal-copilot";
import { VENDOR_SIGN_IN, vendorPortalAuthApi, vendorPortalAuthKeys } from "@/lib/api/vendor-portal-client";
import { VENDOR_NAV, VENDOR_PUBLIC_PATHS } from "./nav-items";

/** Vendor Portal shell (Epic 14, FR-79): sign-in pages in the auth frame, the rest behind the `tos_vendor` session. */
export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ExternalPortalFrame
      home="/vendor"
      title="Vendor portal"
      signInPath={VENDOR_SIGN_IN}
      publicPaths={VENDOR_PUBLIC_PATHS}
      nav={VENDOR_NAV}
      meKey={vendorPortalAuthKeys.me}
      loadMe={vendorPortalAuthApi.me}
      logout={vendorPortalAuthApi.logout}
    >
      {children}
      <PortalCopilot portal="vendor" />
    </ExternalPortalFrame>
  );
}
