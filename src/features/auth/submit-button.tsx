"use client";

import { Button, makeStyles, Spinner } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: { width: "100%" },
});

/** Full-width primary submit button showing a spinner while `pending`. */
export function SubmitButton({ pending, disabled, children }: { pending: boolean; disabled?: boolean; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <Button
      type="submit"
      appearance="primary"
      size="large"
      className={styles.root}
      disabled={disabled ?? pending}
      icon={pending ? <Spinner size="tiny" /> : undefined}
    >
      {children}
    </Button>
  );
}
