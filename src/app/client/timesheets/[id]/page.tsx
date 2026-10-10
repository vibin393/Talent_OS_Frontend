import { ClientTimesheetDetailView } from "@/features/timesheets/client-timesheet-detail";

export default async function Page({ params }: PageProps<"/client/timesheets/[id]">) {
  const { id } = await params;
  return <ClientTimesheetDetailView key={id} id={id} />;
}
