"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { isNavActive, NAV_ITEMS } from "./nav";

/**
 * Barra de secciones al pie, para teléfono y tablet: las cinco secciones a un toque del pulgar.
 * En escritorio no se muestra (se navega con el menú lateral, como en el diseño).
 */
export function BottomNav() {
  const t = useTranslations();
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label={t("sections")}>
      {NAV_ITEMS.map(({ id, href, icon: Icon, label, short }) => (
        <Link
          key={id}
          href={href}
          className="bottom-nav-item"
          aria-label={t(label)}
          aria-current={isNavActive(href, pathname) ? "page" : undefined}
        >
          <span className="bottom-nav-icon">
            <Icon size={22} />
          </span>
          <span aria-hidden="true">{t(short ?? label)}</span>
        </Link>
      ))}
    </nav>
  );
}
