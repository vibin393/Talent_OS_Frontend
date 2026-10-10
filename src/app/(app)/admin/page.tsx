import type { Metadata } from "next";
import { AdminHome } from "@/features/admin/admin-home";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return <AdminHome />;
}
