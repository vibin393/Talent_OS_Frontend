import type { Metadata } from "next";
import { isSmartList } from "@/features/tasks/task-model";
import { TasksPage } from "@/features/tasks/tasks-page";
import { CopilotListContext } from "@/features/copilot/list-context";

export const metadata: Metadata = { title: "Tasks" };

export default async function Page({ searchParams }: PageProps<"/tasks">) {
  const { list } = await searchParams;
  return (
    <>
      <CopilotListContext kind="tasks" />
      <TasksPage initialList={isSmartList(list) ? list : "my_day"} />
    </>
  );
}
