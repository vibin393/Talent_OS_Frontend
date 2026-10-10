import { makeStyles, tokens } from "@fluentui/react-components";

/** Shared layout for the signed-out forms. */
export const useFormStyles = makeStyles({
  form: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  links: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: tokens.spacingVerticalS,
  },
  center: {
    alignSelf: "center",
  },
  skeleton: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  skeletonLine: { width: "66%" },
  skeletonBlock: { height: "160px" },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  muted: {
    color: tokens.colorNeutralForeground2,
  },
});
