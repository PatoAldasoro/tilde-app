import { useTranslations } from "next-intl";
import { getImageProps } from "next/image";
import { GoogleButton } from "@/components/google-button";
import { LogoSymbol } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { LandingTop } from "./landing-top";

/** Un bloque por funcionalidad, con su captura real (scripts/screenshots.ts → public/landing). */
const FEATURES = ["subjects", "schedule", "tasks", "calendar", "grades", "sessions"] as const;
/** Desde 768 px, la captura de la computadora; más angosto, la del teléfono (los anchos salen de landing.css). */
const SHOT = { width: 1440, height: 846, sizes: "(max-width: 1100px) calc(100vw - 160px), 960px" };
const PHONE_SHOT = { width: 390, height: 844, sizes: "(max-width: 434px) calc(100vw - 74px), 360px" };
const WIDE = "(min-width: 768px)";

function Shot({ feature, theme, alt }: { feature: string; theme: "light" | "dark"; alt: string }) {
  const { props: wide } = getImageProps({ ...SHOT, alt, src: `/landing/${feature}-${theme}.png` });
  const { props: phone } = getImageProps({ ...PHONE_SHOT, alt, src: `/landing/${feature}-${theme}-mobile.png` });
  return (
    <picture>
      <source media={WIDE} srcSet={wide.srcSet} sizes={wide.sizes} />
      <img {...phone} alt={alt} className={`shot-${theme}`} />
    </picture>
  );
}

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
        {FEATURES.map((feature, index) => (
          <section className="feature" key={feature} aria-labelledby={`feature-${feature}`}>
            <div className="feature-inner">
              <span className="feature-kicker">
                <span className="n" aria-hidden="true">
                  0{index + 1}
                </span>
                {t(`nav_feature_${feature}`)}
              </span>
              <h2 id={`feature-${feature}`}>{t(`feat_${feature}_title`)}</h2>
              <p>{t(`feat_${feature}_text`)}</p>
              <div className="shot">
                {(["light", "dark"] as const).map((theme) => (
                  <Shot key={theme} feature={feature} theme={theme} alt={t(`shot_alt_${feature}`)} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
