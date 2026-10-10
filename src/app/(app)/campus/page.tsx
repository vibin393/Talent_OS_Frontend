import { redirect } from "next/navigation";

/** `/campus` (Epic 43): the drives list is the landing page. */
export default function CampusPage() {
  redirect("/campus/drives");
}
