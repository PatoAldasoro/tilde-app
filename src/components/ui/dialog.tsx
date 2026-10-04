"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReturnFocus } from "./use-return-focus";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

type DialogContentProps = Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Sin botón de cierre: el diálogo exige elegir una de sus acciones. */
  hideClose?: boolean;
};

/** Diálogo modal del diseño: foco atrapado, Esc cierra y el foco vuelve al disparador. */
export function DialogContent({ title, description, size = "md", hideClose, className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }: DialogContentProps) {
  const t = useTranslations();
  const returnFocus = useReturnFocus();
  return (
    <DialogPrimitive.Portal>
      <div className="dialog-layer" role="presentation">
        <DialogPrimitive.Overlay className="scrim" />
        <DialogPrimitive.Content
          className={cn("dialog", size === "sm" && "dialog-sm", size === "lg" && "dialog-lg", className)}
          {...(description ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={(event) => {
            returnFocus.onOpenAutoFocus();
            onOpenAutoFocus?.(event);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            returnFocus.onCloseAutoFocus(event);
          }}
          {...props}
        >
          <div className="dialog-head">
            <div>
              <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="dialog-desc">{description}</DialogPrimitive.Description>
              ) : null}
            </div>
            {hideClose ? null : (
              <DialogPrimitive.Close className="btn btn-ghost btn-icon" aria-label={t("close")}>
                <X size={20} />
              </DialogPrimitive.Close>
            )}
          </div>
          {children}
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("dialog-body", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("dialog-foot", className)} {...props} />;
}
