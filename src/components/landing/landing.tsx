import { useTranslations } from "next-intl";
import { GoogleButton } from "@/components/google-button";
import { Logo, LogoSymbol } from "@/components/logo";
import { LandingTop } from "./landing-top";

/** Landing: barra fija, hero y un bloque por funcionalidad. Sin secciones extra. */
export function Landing() {
  const t = useTranslations();
  return (
    <div className="landing">
      <LandingTop />
      <main id="main" tabIndex={-1}>
        <section className="hero">
          <LogoSymbol size={64} className="hero-mark" />
          <h1>Tilde</h1>
          <p>{t("hero_line")}</p>
          <GoogleButton large />
          <span className="hero-note">{t("hero_note")}</span>
        </section>
      </main>
      <footer className="landing-foot">
        <span className="text-text">
          <Logo size={22} />
        </span>
        <span>{t("footer_line")}</span>
        <span className="grow" />
        <span className="tnum">© 2026</span>
      </footer>
    </div>
  );
}
