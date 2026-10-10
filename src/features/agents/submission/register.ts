/** Epic 61: registers the "Submission pack" panel in the Application drawer's Submissions tab (`agent_submission`). */
import { registerApplicationPanel } from "@/features/pipeline/application-panels";
import { SubmissionPackPanel } from "./submission-pack-panel";

registerApplicationPanel({
  key: "agent_submission",
  permission: "submission:read",
  order: 10,
  tab: "submissions",
  component: SubmissionPackPanel,
});
