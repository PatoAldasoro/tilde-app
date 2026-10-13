import type { MetadataRoute } from "next";

/**
 * Manifiesto de la app web: con esto Tilde se puede instalar en el teléfono o la computadora
 * ("Agregar a la pantalla de inicio") y abre en su propia ventana, directo en la app.
 * Es un solo archivo para los dos idiomas, así que sus textos no pasan por `messages/`; los colores
 * son los de fondo del tema claro (acá no llegan los tokens).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tilde",
    short_name: "Tilde",
    description: "Tus materias, tu semana y tus pendientes en un solo lugar.",
    lang: "es",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#FAF9F7",
    theme_color: "#FAF9F7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
