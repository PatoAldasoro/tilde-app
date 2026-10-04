import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Landing } from "@/components/landing/landing";
import { localePrefix, routing, type Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale });
  return {
    title: { absolute: `Tilde — ${t("hero_line").split(".")[0]}` },
    description: t("hero_line"),
    alternates: {
      canonical: localePrefix(locale as Locale) || "/",
      languages: Object.fromEntries(routing.locales.map((l) => [l, localePrefix(l) || "/"])),
    },
    openGraph: { title: "Tilde", description: t("hero_line"), type: "website", locale },
  };
}

/** Landing pública, estática e indexable en ambos idiomas ("/" y "/en"). */
export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <Landing />;
}
