"use client";

import { Settings, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Logo } from "@/components/logo";
import { useSessionUser, useUpdateProfile } from "@/components/providers";
import { useReturnFocus } from "@/components/ui/use-return-focus";
import { Link, usePathname } from "@/i18n/navigation";
import { Avatar } from "./avatar";
import { isNavActive, NAV_ITEMS } from "./nav";
import { ThemeSegmented } from "./preferences";

type DrawerProps = { open: boolean; onOpenChange: (open: boolean) => void; onOpenSettings: () => void };

/** Menú lateral: se superpone al contenido con un velo y se cierra al elegir, con Esc o tocando afuera. */
export function Drawer({ open, onOpenChange, onOpenSettings }: DrawerProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const user = useSessionUser();
  const updateProfile = useUpdateProfile();
  const returnFocus = useReturnFocus();
  const close = () => onOpenChange(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <div className="drawer-layer" role="presentation">
          <DialogPrimitive.Overlay className="scrim" />
          <DialogPrimitive.Content asChild aria-describedby={undefined} {...returnFocus}>
            <nav className="drawer" id="drawer" aria-label={t("menu")}>
              <DialogPrimitive.Title className="visually-hidden">{t("menu")}</DialogPrimitive.Title>
              <div className="drawer-head">
                <Link href="/app" className="logo-link text-inherit" aria-label={`Tilde — ${t("nav_home")}`} onClick={close}>
                  <Logo size={28} />
                </Link>
                <DialogPrimitive.Close className="btn btn-ghost btn-icon" aria-label={t("close_menu")}>
                  <X size={20} />
                </DialogPrimitive.Close>
              </div>
              <div className="drawer-nav">
                {NAV_ITEMS.map(({ id, href, icon: Icon, label }) => (
                  <Link
                    key={id}
                    className="nav-item"
                    href={href}
                    aria-current={isNavActive(href, pathname) ? "page" : undefined}
                    onClick={close}
                  >
                    <Icon size={20} />
                    <span>{t(label)}</span>
                  </Link>
                ))}
              </div>
              <div className="drawer-foot">
                <div className="profile">
                  <Avatar user={user} />
                  <div className="min-w-0">
                    <div className="profile-name">{user.name}</div>
                    <div className="profile-mail">{user.email}</div>
                  </div>
                </div>
                <button type="button" className="nav-item" onClick={onOpenSettings}>
                  <Settings size={20} />
                  <span>{t("settings")}</span>
                </button>
                {/* El idioma se cambia en Ajustes; acá queda solo el tema, que se toca más seguido. */}
                <div className="drawer-row">
                  <ThemeSegmented onSaved={(theme) => updateProfile.mutate({ theme })} />
                </div>
              </div>
            </nav>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
