import type { Metadata } from "next";
import { OnboardingQuestionsInbox } from "@/features/knowledge/questions-inbox";

export const metadata: Metadata = { title: "Onboarding questions" };

export default async function Page({ searchParams }: PageProps<"/onboarding/questions">) {
  const sp = await searchParams;
  const thread = typeof sp.thread === "string" ? sp.thread : null;
  return <OnboardingQuestionsInbox initialThread={thread} />;
}
