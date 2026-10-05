import "@fontsource-variable/geist";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/roboto/500.css";
import "../globals.css";

import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { InlineScript } from "@/components/inline-script";
import { ConfirmHost } from "@/components/ui/confirm";
import { Toaster } from "@/components/ui/toast";
import { routing } from "@/i18n/routing";
import { headScript } from "@/lib/accent";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale });
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: "Tilde", template: "%s · Tilde" },
    description: t("app_tagline"),
  };
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9F7" },
    { media: "(prefers-color-scheme: dark)", color: "#131211" },
  ],
};

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    // data-theme y data-accent los fija el script de <head> antes del primer pintado.
    <html lang={locale} data-theme="light" suppressHydrationWarning>
      <head>
        <InlineScript html={headScript} />
      </head>
      <body>
        <NextIntlClientProvider>
          <a href="#main" className="skip-link">
            {t("skip_to_content")}
          </a>
          {children}
          <Toaster />
          <ConfirmHost />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
