"use client";

import { Toast, ToastTitle, type ToastIntent, useToastController } from "@fluentui/react-components";
import { useMemo } from "react";

/** Id of the single app-wide Fluent `Toaster` mounted in `Providers`. */
export const APP_TOASTER_ID = "app-toaster";

/** Dispatch a toast to the app-wide Toaster. */
export function useAppToast() {
  const { dispatchToast } = useToastController(APP_TOASTER_ID);
  return useMemo(() => {
    const show = (intent: ToastIntent, message: string) =>
      dispatchToast(
        <Toast>
          <ToastTitle>{message}</ToastTitle>
        </Toast>,
        { intent, politeness: intent === "error" ? "assertive" : "polite" },
      );
    return {
      success: (message: string) => show("success", message),
      error: (message: string) => show("error", message),
      info: (message: string) => show("info", message),
    };
  }, [dispatchToast]);
}
