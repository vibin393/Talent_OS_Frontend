"use client";

import { Body1, Card, makeStyles, Text, Title3, tokens } from "@fluentui/react-components";
import { People24Filled } from "@fluentui/react-icons";

const useStyles = makeStyles({
  page: {
    minHeight: "100svh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: `${tokens.spacingVerticalXXXL} ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground2,
    backgroundImage: `linear-gradient(135deg, ${tokens.colorBrandBackground2} 0%, ${tokens.colorNeutralBackground2} 55%)`,
  },
  main: {
    width: "100%",
    maxWidth: "440px",
  },
  card: {
    width: "100%",
    padding: "44px",
    gap: tokens.spacingVerticalL,
    boxShadow: tokens.shadow16,
    "@media (max-width: 479px)": {
      padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXL}`,
    },
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  brandMark: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  heading: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  description: {
    color: tokens.colorNeutralForeground2,
  },
  footer: {
    marginTop: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
  },
});

/** Page chrome for the signed-out pages: a subtle background like the Microsoft sign-in page. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <div className={styles.page}>
      <main className={styles.main}>{children}</main>
      <Text size={200} className={styles.footer}>
        © Talent OS
      </Text>
    </div>
  );
}

/** Centered sign-in style card: product name, page heading, description and the form. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <Card className={styles.card}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden>
          <People24Filled />
        </span>
        <Text weight="semibold" size={500}>
          Talent OS
        </Text>
      </div>
      <div className={styles.heading}>
        <Title3 as="h1">{title}</Title3>
        {description && <Body1 className={styles.description}>{description}</Body1>}
      </div>
      {children}
    </Card>
  );
}
