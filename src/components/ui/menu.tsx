"use client";

import { Check } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({ className, align = "end", sideOffset = 6, ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content className={cn("popover", className)} align={align} sideOffset={sideOffset} collisionPadding={8} {...props} />
    </MenuPrimitive.Portal>
  );
}

type MenuItemProps = ComponentProps<typeof MenuPrimitive.Item> & { icon?: ReactNode; danger?: boolean };

export function MenuItem({ className, icon, danger, children, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item className={cn("menu-item", danger && "danger", className)} {...props}>
      {icon}
      <span>{children}</span>
    </MenuPrimitive.Item>
  );
}

export function MenuSeparator() {
  return <MenuPrimitive.Separator className="menu-sep" />;
}

/** Título de un grupo de opciones dentro del menú. */
export function MenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("menu-label", className)} {...props} />;
}

export const MenuRadioGroup = MenuPrimitive.RadioGroup;

/** Opción de un grupo excluyente: la elegida lleva un tilde a la derecha. */
export function MenuRadioItem({ className, children, ...props }: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn("menu-item", className)} {...props}>
      <span className="min-w-0 flex-1">{children}</span>
      <MenuPrimitive.ItemIndicator>
        <Check size={18} />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}
