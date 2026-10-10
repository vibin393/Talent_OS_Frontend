import type { Metadata } from "next";
import { MyInterviews } from "@/features/interviews/my-interviews";
import { CopilotListContext } from "@/features/copilot/list-context";

export const metadata: Metadata = { title: "My interviews" };

export default function Page() {
  return (
    <>
      <CopilotListContext kind="interviews" />
      <MyInterviews />
    </>
  );
}
