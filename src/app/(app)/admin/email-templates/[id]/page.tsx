import type { Metadata } from "next";
import { TemplateEditorPage } from "@/features/comms/template-editor";

export const metadata: Metadata = { title: "Email template" };

export default async function Page({ params }: PageProps<"/admin/email-templates/[id]">) {
  const { id } = await params;
  return <TemplateEditorPage key={id} id={id} />;
}
