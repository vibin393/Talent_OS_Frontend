import type { Metadata } from "next";
import { PredictionsAdmin } from "@/features/predictions/predictions-admin";

export const metadata: Metadata = { title: "Predictions" };

export default function Page() {
  return <PredictionsAdmin />;
}
