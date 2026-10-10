/**
 * Epic 60: registers the "Interview assistant" panel in the Interview drawer (`interview_assistant`). Imported once by
 * `interview-drawer.tsx`.
 */
import { registerInterviewPanel } from "@/features/interviews/interview-panels";
import { InterviewAssistantPanel } from "./capture-panel";

registerInterviewPanel({ key: "interview_assistant", permission: "interview:read", order: 20, component: InterviewAssistantPanel });
