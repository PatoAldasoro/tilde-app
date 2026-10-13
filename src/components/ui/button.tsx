import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Children, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Variantes del botón del diseño (`.btn` en src/styles/controls.css). */
export const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "btn-primary",
      secondary: "btn-secondary",
      ghost: "btn-ghost",
      danger: "btn-danger",
      "danger-ghost": "btn-danger-ghost",
      accent: "btn-accent",
    },
    size: { default: "", sm: "btn-sm", lg: "btn-lg" },
    icon: { true: "btn-icon", false: "" },
  },
  defaultVariants: { variant: "secondary", size: "default", icon: false },
});

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, icon, asChild, loading, type, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, icon }), loading && "is-loading", className)}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* El texto va en su propio span: donde no hay lugar (la barra superior en el teléfono) se deja solo el ícono sin perder el nombre. */}
      {asChild
        ? children
        : Children.map(children, (child) => (typeof child === "string" || typeof child === "number" ? <span className="btn-label">{child}</span> : child))}
    </Comp>
  );
}
