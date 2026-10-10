import type { Metadata } from "next";
import { FxFeedView } from "@/features/legal-entities/fx-feed/fx-feed-view";

export const metadata: Metadata = { title: "FX feed" };

export default function Page() {
  return <FxFeedView />;
}
