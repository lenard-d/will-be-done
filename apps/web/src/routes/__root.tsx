import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { TRPCProvider, trpcClient } from "@/lib/trpc";
import { queryClient } from "@/lib/query";
import { PromptDialogHost } from "@/components/ui/prompt-dialog";
import { HyperDBDevtools } from "@will-be-done/hyperdb-devtool/react";
import { useDevtoolsEnabled } from "@/lib/devtools";
import { Toaster } from "@/components/ui/sonner";
import { PwaUpdateController } from "@/components/PwaUpdateController";

export const Route = createRootRoute({
  component: RouteComponent,
});

function RouteComponent() {
  const devtoolsEnabled = useDevtoolsEnabled();

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <HeadContent />
        <Outlet />
        <PwaUpdateController />
        <Toaster />
        <PromptDialogHost />
        {devtoolsEnabled && (
          <HyperDBDevtools
            position="bottom"
            buttonPosition="bottom-right"
            maxTraces={1000}
          />
        )}

        {/* <TanStackRouterDevtools position="bottom-right" /> */}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
