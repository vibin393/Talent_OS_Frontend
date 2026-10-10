/** Epic 57: registers the "AI screening" panel in the Application drawer (imported once by `application-drawer.tsx`). */
import { registerApplicationPanel } from "@/features/pipeline/application-panels";
import { ConversationPanel } from "./conversation-panel";

registerApplicationPanel({ key: "agent_screening", permission: "application:read", order: 10, component: ConversationPanel });
