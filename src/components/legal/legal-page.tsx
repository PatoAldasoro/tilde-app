import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Link } from "@/i18n/navigation";
import { CONTACT_EMAIL } from "@/lib/contact";

/** Título, entrada y secciones (título y párrafos) de cada página. */
const DOCS = {
  privacy: {
    title: "privacy_title",
    lead: "privacy_lead",
    sections: [
      ["privacy_data", ["privacy_data_1", "privacy_data_2", "privacy_data_3"]],
      ["privacy_where", ["privacy_where_1", "privacy_where_2"]],
      ["privacy_use", ["privacy_use_1"]],
      ["privacy_device", ["privacy_device_1", "privacy_device_2"]],
      ["privacy_delete", ["privacy_delete_1", "privacy_delete_2"]],
      ["privacy_changes", ["privacy_changes_1"]],
    ],
  },
  terms: {
    title: "terms_title",
    lead: "terms_lead",
    sections: [
      ["terms_account", ["terms_account_1"]],
      ["terms_use", ["terms_use_1"]],
      ["terms_warranty", ["terms_warranty_1", "terms_warranty_2"]],
      ["terms_privacy", ["terms_privacy_1"]],
      ["terms_changes", ["terms_changes_1"]],
    ],
  },
} as const;

export type LegalDoc = keyof typeof DOCS;

const privacyLink = (chunks: ReactNode) => <Link href="/privacy">{chunks}</Link>;

/**
 * Privacidad y términos: texto de lectura, público y en los dos idiomas. No usa la barra de la
 * landing, que borra lo guardado de una cuenta (esta página también la puede abrir alguien con sesión).
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = useTranslations();
  const page = DOCS[doc];
  return (
    <div className="landing">
      <header className="landing-top">
        <Link href="/" className="logo-link text-inherit" aria-label="Tilde">
          <Logo size={30} />
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="legal-doc">
        <h1>{t(page.title)}</h1>
        <p className="legal-updated">{t("legal_updated")}</p>
        <p className="legal-lead">{t(page.lead)}</p>
        {page.sections.map(([heading, paragraphs]) => (
          <section key={heading} aria-labelledby={heading}>
            <h2 id={heading}>{t(heading)}</h2>
            {paragraphs.map((key) => (
              <p key={key}>{t.rich(key, { link: privacyLink })}</p>
            ))}
          </section>
        ))}
        {CONTACT_EMAIL ? (
          <section aria-labelledby="legal-contact">
            <h2 id="legal-contact">{t("legal_contact")}</h2>
            <p>
              {t.rich("legal_contact_text", {
                email: CONTACT_EMAIL,
                link: (chunks) => <a href={`mailto:${CONTACT_EMAIL}`}>{chunks}</a>,
              })}
            </p>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
