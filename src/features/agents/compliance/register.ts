/** Epic 62: registers the "Compliance chasing" card on the Placement page (`compliance:read`). */
import { registerPlacementPanel } from "@/features/placements/placement-panels";
import { PlacementChaseLog } from "./chase-log-card";

registerPlacementPanel({ key: "agent_compliance_chasing", permission: "compliance:read", order: 40, component: PlacementChaseLog });
