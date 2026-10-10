"use client";

import { ExternalPortalFrame } from "@/features/external-portal/portal-frame";
import { PortalCopilot } from "@/features/portal-copilot/portal-copilot";
import { CLIENT_SIGN_IN, clientPortalApi, clientPortalKeys } from "@/lib/api/client-portal-client";
import { CLIENT_NAV, CLIENT_PUBLIC_PATHS } from "./nav-items";

/** Client Portal shell (Epic 14, FR-78): sign-in pages in the auth frame, the rest behind the `tos_client` session. */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ExternalPortalFrame
      home="/client"
      title="Client portal"
      signInPath={CLIENT_SIGN_IN}
      publicPaths={CLIENT_PUBLIC_PATHS}
      nav={CLIENT_NAV}
      meKey={clientPortalKeys.me}
      loadMe={clientPortalApi.me}
      logout={clientPortalApi.logout}
    >
      {children}
      <PortalCopilot portal="client" />
    </ExternalPortalFrame>
  );
}
