"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      gap={10}
      offset={{
        right: "max(16px, env(safe-area-inset-right))",
        bottom: "var(--update-toast-bottom-offset)",
      }}
      mobileOffset={{
        left: "12px",
        right: "12px",
        bottom: "var(--update-toast-mobile-bottom-offset)",
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast border-update-toast-border bg-update-toast-surface text-update-toast-title shadow-update-toast backdrop-blur-2xl",
          title: "text-update-toast-title font-semibold",
          description: "text-update-toast-description",
          actionButton:
            "bg-update-toast-action text-update-toast-action-content hover:bg-update-toast-action-hover",
          cancelButton:
            "bg-update-toast-cancel text-update-toast-title hover:bg-update-toast-cancel-hover",
          closeButton:
            "border-update-toast-border bg-update-toast-surface text-update-toast-description hover:text-update-toast-title",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
