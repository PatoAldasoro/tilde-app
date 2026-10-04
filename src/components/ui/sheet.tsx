"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReturnFocus } from "./use-return-focus";

export const Sheet = DialogPrimitive.Root;

type SheetContentProps = Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  /** Nombre accesible del panel. */
  label: string;
  /** Contenido visible del encabezado (a la izquierda del botón de cierre). */
  head?: ReactNode;
};

/** Panel lateral derecho, sin velo: la lista de atrás se sigue viendo. */
export function SheetContent({ label, head, className, children, ...props }: SheetContentProps) {
  const t = useTranslations();
  const returnFocus = useReturnFocus();
  return (
    <DialogPrimitive.Portal>
      <div className="sheet-layer" role="presentation">
        <DialogPrimitive.Overlay className="scrim" />
        <DialogPrimitive.Content className={cn("sheet", className)} aria-describedby={undefined} {...returnFocus} {...props}>
          <div className="sheet-head">
            <DialogPrimitive.Title className={head ? "visually-hidden" : "sheet-title"}>{label}</DialogPrimitive.Title>
            {head}
            <DialogPrimitive.Close className="btn btn-ghost btn-icon" aria-label={t("close")}>
              <X size={20} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("sheet-body", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("sheet-foot", className)} {...props} />;
}
