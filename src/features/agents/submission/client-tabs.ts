/** Epic 61: registers the Client 360 "Submission rules" tab (imported once by `client-360.tsx`). */
import { registerClient360Tab } from "@/features/clients/client-360-tabs";
import { ClientSubmissionRules } from "./client-submission-rules";

registerClient360Tab({
  key: "submission-rules",
  label: "Submission rules",
  permission: ["pipeline:configure", "client:read"],
  order: 90,
  component: ClientSubmissionRules,
});
