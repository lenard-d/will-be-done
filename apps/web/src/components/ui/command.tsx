import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "bg-dialog-bg text-content flex h-full w-full flex-col overflow-hidden rounded-md",
        className,
      )}
      {...props}
    />
  );
}

const MotionDialogContent = motion.create(DialogContent);
const MOBILE_REVEAL_OFFSET = 12;
const OPENING_DURATION = 0.18;
const BACKGROUND_BLUR = 8;
const BACKGROUND_DIM = 0.35;

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  onCloseAutoFocus,
  reveal,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  reveal?: {
    phase: "idle" | "dragging" | "closing";
    progress: MotionValue<number>;
  };
  onCloseAutoFocus?: React.ComponentProps<
    typeof DialogContent
  >["onCloseAutoFocus"];
}) {
  const openingAnimation = React.useRef<ReturnType<typeof animate> | null>(
    null,
  );
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const mobile = !!reveal;
  const fallbackProgress = useMotionValue(0);
  const progress = reveal?.progress ?? fallbackProgress;
  const reducedMotion = useReducedMotion();
  const preview = !!reveal && !props.open && reveal.phase !== "idle";
  const transform = useTransform(
    progress,
    (value) =>
      `translate(-50%, ${reducedMotion ? 0 : (value - 1) * MOBILE_REVEAL_OFFSET}px)`,
  );
  const backdropFilter = useTransform(
    progress,
    (value) => `blur(${reducedMotion ? 0 : value * BACKGROUND_BLUR}px)`,
  );
  const backgroundColor = useTransform(
    progress,
    (value) => `rgba(0, 0, 0, ${value * BACKGROUND_DIM})`,
  );
  React.useEffect(() => {
    if (!props.open && !preview) progress.jump(0);
  }, [props.open, preview, progress]);
  const mountContent = React.useCallback(
    (element: HTMLDivElement | null) => {
      openingAnimation.current?.stop();
      if (!mobile || !element || !props.open) return;
      openingAnimation.current = animate(progress, 1, {
        duration: reducedMotion ? 0 : OPENING_DURATION,
        ease: "easeOut",
      });
    },
    [progress, props.open, reducedMotion, mobile],
  );
  const backdrop = (
    <motion.div
      data-slot="dialog-overlay"
      aria-hidden="true"
      className="command-palette-mobile-overlay fixed inset-0 z-50"
      style={{
        backgroundColor,
        backdropFilter,
        pointerEvents: preview ? "none" : "auto",
      }}
    />
  );
  const mobileOverlay = preview ? (
    backdrop
  ) : (
    <DialogOverlay asChild>{backdrop}</DialogOverlay>
  );
  return (
    <Dialog {...props} modal={preview ? false : props.modal}>
      <MotionDialogContent
        ref={mountContent}
        overlay={mobile ? mobileOverlay : undefined}
        forceMount={preview ? true : undefined}
        aria-hidden={preview ? true : undefined}
        inert={preview ? true : undefined}
        onOpenAutoFocus={(event) => {
          if (preview) {
            event.preventDefault();
            return;
          }
          returnFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          if (preview) {
            event.preventDefault();
            return;
          }
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus({ preventScroll: true });
          }
        }}
        onInteractOutside={
          preview ? (event) => event.preventDefault() : undefined
        }
        style={
          reveal
            ? {
                transform,
                opacity: progress,
                pointerEvents: preview ? "none" : "auto",
              }
            : undefined
        }
        className={cn(
          "overflow-hidden border-dialog-border bg-dialog-bg p-0 text-content",
          reveal && "command-palette-mobile",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="[&_[cmdk-group-heading]]:text-content-tinted **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </MotionDialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-b px-3"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "placeholder:text-content-tinted-2 flex h-10 w-full rounded-md bg-transparent py-3 text-sm text-content outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "text-content [&_[cmdk-group-heading]]:text-content-tinted overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "text-content data-[selected=true]:bg-accent data-[selected=true]:text-white [&_svg:not([class*='text-'])]:text-content-tinted data-[selected=true]:[&_svg]:text-white relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "text-content-tinted ml-auto text-xs tracking-widest",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
