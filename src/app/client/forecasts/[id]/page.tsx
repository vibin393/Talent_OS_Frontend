import { ClientForecastDetail } from "@/features/workforce/client-forecasts";

/** Client Portal: a hiring forecast's status and roles (Epic 44). */
export default async function Page({ params }: PageProps<"/client/forecasts/[id]">) {
  const { id } = await params;
  return <ClientForecastDetail key={id} id={id} />;
}
