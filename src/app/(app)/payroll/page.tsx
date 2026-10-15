import type { Metadata } from "next";
import { RequireModule } from "@/features/entitlements/require-module";
import { PayrollHome } from "@/features/payroll/payroll-home";

export const metadata: Metadata = { title: "Payroll" };

// Phase 2 demo of the entitlement route guard: if the tenant's plan lacks the `payroll` module, a
// "Not in your plan" empty state replaces the page (on top of the existing `payroll:read` RBAC check).
export default function Page() {
  return (
    <RequireModule module="payroll">
      <PayrollHome />
    </RequireModule>
  );
}
