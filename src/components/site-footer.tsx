import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { CONTACT_EMAIL } from "@/lib/contact";

/** Pie de la landing y de las páginas de privacidad y términos. */
export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="landing-foot">
      <span className="text-text">
        <Logo size={22} />
      </span>
      <span>{t("footer_line")}</span>
      <span className="grow" />
      <nav className="foot-links" aria-label={t("footer_nav")}>
        <Link href="/privacy">{t("footer_privacy")}</Link>
        <Link href="/terms">{t("footer_terms")}</Link>
        {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{t("footer_contact")}</a> : null}
      </nav>
      <span className="tnum">© 2026</span>
    </footer>
  );
}
