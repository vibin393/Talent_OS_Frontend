import { AdminFrame } from "@/features/admin/admin-frame";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
