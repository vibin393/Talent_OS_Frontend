/**
 * Epic 59: registers the "Scheduling" panel in the Application drawer (`agent_scheduling`) and "Scheduling history"
 * in the Interview drawer (`scheduling`). Imported once by `interview-drawer.tsx` and `application-drawer.tsx`.
 */
import { registerInterviewPanel } from "@/features/interviews/interview-panels";
import { registerApplicationPanel } from "@/features/pipeline/application-panels";
import { ApplicationSchedulingPanel, InterviewSchedulingPanel } from "./scheduling-panel";

registerApplicationPanel({ key: "agent_scheduling", permission: "interview:read", order: 20, component: ApplicationSchedulingPanel });
registerInterviewPanel({ key: "scheduling", permission: "interview:read", order: 10, component: InterviewSchedulingPanel });
