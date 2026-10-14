import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";
import { localePrefix, routing, type Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale });
  return {
    title: t("privacy_title"),
    description: t("privacy_description"),
    alternates: {
      canonical: `${localePrefix(locale as Locale)}/privacy`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${localePrefix(l)}/privacy`])),
    },
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LegalPage doc="privacy" />;
}
