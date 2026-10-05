import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Sin el indicador flotante de desarrollo: tapa la interfaz (y saldría en las capturas).
  devIndicators: false,
};

export default withNextIntl(nextConfig);
