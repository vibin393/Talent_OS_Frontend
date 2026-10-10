/** Epic 58: registers the "Voice screening" panel in the Application drawer (imported once by `application-drawer.tsx`). */
import { registerApplicationPanel } from "@/features/pipeline/application-panels";
import { VoicePanel } from "./voice-panel";

registerApplicationPanel({ key: "voice_screening", permission: "application:read", order: 12, component: VoicePanel });
