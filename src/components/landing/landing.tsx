import { useTranslations } from "next-intl";
import Image from "next/image";
import { GoogleButton } from "@/components/google-button";
import { Logo, LogoSymbol } from "@/components/logo";
import { LandingTop } from "./landing-top";

/** Un bloque por funcionalidad, con su captura real (scripts/screenshots.ts → public/landing). */
const FEATURES = ["subjects", "schedule", "tasks", "calendar", "grades", "sessions"] as const;
const SHOT = { width: 1440, height: 846 };

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
                  <Image
                    key={theme}
                    className={`shot-${theme}`}
                    src={`/landing/${feature}-${theme}.png`}
                    alt={t(`shot_alt_${feature}`)}
                    width={SHOT.width}
                    height={SHOT.height}
                    sizes="(max-width: 1100px) calc(100vw - 160px), 960px"
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
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
