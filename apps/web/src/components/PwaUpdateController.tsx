import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

const UPDATE_TOAST_ID = "pwa-update-available";
const UPDATE_CHECK_INTERVAL_MS = 10_000;

function isManualBrowserReload() {
  const [navigationEntry] = performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];

  if (navigationEntry) {
    return navigationEntry.type === "reload";
  }

  return false;
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

    toast("New version available", {
      id: UPDATE_TOAST_ID,
      description: "Reload to start using the latest frontend.",
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => {
          setUpdateToastDismissed(true);
          void updateServiceWorker(true);
        },
      },
      cancel: {
        label: "Dismiss",
        onClick: () => {
          setUpdateToastDismissed(true);
          toast.dismiss(UPDATE_TOAST_ID);
        },
      },
    });
  }, [needRefresh, updateServiceWorker, updateToastDismissed]);

  return null;
}
