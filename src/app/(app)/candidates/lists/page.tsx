import type { Metadata } from "next";
import { ListsView } from "@/features/candidates/lists-view";

export const metadata: Metadata = { title: "Saved lists" };

export default function Page() {
  return <ListsView />;
}
