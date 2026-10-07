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
    distance: MotionValue<number>;
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
  const fallbackDistance = useMotionValue(0);
  const distance = reveal?.distance ?? fallbackDistance;
  const panelHeight = useMotionValue(0);
  const clipPath = useTransform(
    () =>
      `inset(0px 0px ${Math.max(0, panelHeight.get() - distance.get())}px 0px round 8px)`,
  );
  const reducedMotion = useReducedMotion();
  const preview = !!reveal && !props.open && reveal.phase !== "idle";
  const mountContent = React.useCallback(
    (element: HTMLDivElement | null) => {
      openingAnimation.current?.stop();
      if (!mobile || !element) return;
      panelHeight.set(element.offsetHeight);
      if (!props.open) return;
      openingAnimation.current = animate(distance, element.offsetHeight, {
        duration: reducedMotion ? 0 : 0.18,
      });
    },
    [distance, panelHeight, props.open, reducedMotion, mobile],
  );
  return (
    <Dialog {...props} modal={preview ? false : props.modal}>
      <MotionDialogContent
        ref={mountContent}
        overlayProps={
          mobile ? { className: "command-palette-mobile-overlay" } : undefined
        }
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
                transform: "translateX(-50%)",
                clipPath,
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
