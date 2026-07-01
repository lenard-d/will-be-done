import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

const UPDATE_TOAST_ID = "pwa-update-available";
const UPDATE_TOAST_PREVIEW_ID = "pwa-update-available-preview";
const UPDATE_TOAST_PREVIEW_PARAM = "pwa-update-toast";
const UPDATE_CHECK_INTERVAL_MS = 30_000;
const shouldPreviewUpdateToastOnLoad =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has(UPDATE_TOAST_PREVIEW_PARAM);

type ShowUpdateToastOptions = {
  id: string;
  onReload: () => void;
  onDismiss: () => void;
};

function isManualBrowserReload() {
  const [navigationEntry] = performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];

  if (navigationEntry) {
    return navigationEntry.type === "reload";
  }

  return false;
}

function shouldPreviewUpdateToast() {
  return shouldPreviewUpdateToastOnLoad;
}

function showUpdateToast({ id, onReload, onDismiss }: ShowUpdateToastOptions) {
  toast("New version available", {
    id,
    description: "Reload to start using the latest version.",
    duration: Infinity,
    action: {
      label: "Reload",
      onClick: onReload,
    },
    cancel: {
      label: "Dismiss",
      onClick: () => {
        onDismiss();
        toast.dismiss(id);
      },
    },
  });
}

export function PwaUpdateController() {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [updateToastDismissed, setUpdateToastDismissed] = useState(false);
  const hasControllerRef = useRef(false);
  const controllerReloadingRef = useRef(false);
  const manualReloadActivationStartedRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_swScriptUrl, serviceWorkerRegistration) => {
      setRegistration(serviceWorkerRegistration ?? null);
    },
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
  });

  useEffect(() => {
    if (!shouldPreviewUpdateToast()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      showUpdateToast({
        id: UPDATE_TOAST_PREVIEW_ID,
        onReload: () => {
          toast.dismiss(UPDATE_TOAST_PREVIEW_ID);
        },
        onDismiss: () => {},
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!registration) {
      return;
    }

    const checkForUpdate = () => {
      void registration.update().catch((error) => {
        console.error("Service worker update check failed", error);
      });
    };

    checkForUpdate();
    const intervalId = window.setInterval(
      checkForUpdate,
      UPDATE_CHECK_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [registration]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    hasControllerRef.current = Boolean(navigator.serviceWorker.controller);

    const handleControllerChange = () => {
      if (!hasControllerRef.current) {
        hasControllerRef.current = true;
        return;
      }

      if (controllerReloadingRef.current) {
        return;
      }

      controllerReloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !registration?.waiting ||
      !navigator.serviceWorker.controller ||
      !isManualBrowserReload() ||
      manualReloadActivationStartedRef.current
    ) {
      return;
    }

    manualReloadActivationStartedRef.current = true;
    void updateServiceWorker(true);
  }, [needRefresh, registration, updateServiceWorker]);

  useEffect(() => {
    if (
      !needRefresh ||
      updateToastDismissed ||
      manualReloadActivationStartedRef.current
    ) {
      toast.dismiss(UPDATE_TOAST_ID);
      return;
    }

    showUpdateToast({
      id: UPDATE_TOAST_ID,
      onReload: () => {
        setUpdateToastDismissed(true);
        void updateServiceWorker(true);
      },
      onDismiss: () => {
        setUpdateToastDismissed(true);
      },
    });
  }, [needRefresh, updateServiceWorker, updateToastDismissed]);

  return null;
}
