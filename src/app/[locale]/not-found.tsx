import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations();
  return (
    <main id="main" className="empty min-h-screen justify-center">
      <Logo size={30} />
      <h1 className="empty-title mt-6">{t("not_found_title")}</h1>
      <p className="empty-text">{t("not_found_text")}</p>
      <Link href="/" className="btn btn-primary">
        {t("back_home")}
      </Link>
    </main>
  );
}
