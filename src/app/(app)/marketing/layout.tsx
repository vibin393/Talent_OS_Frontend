import { MarketingTabs } from "@/features/campaigns/marketing-tabs";

/** `/marketing/*` (Epic 39): shared header and section tabs on the list pages. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingTabs />
      {children}
    </>
  );
}
