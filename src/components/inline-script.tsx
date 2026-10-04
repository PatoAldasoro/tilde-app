"use client";

/**
 * Script en línea que corre antes del primer pintado (tema). En el servidor sale como
 * JavaScript; en el cliente React lo vuelve a rendir como texto inerte, así no avisa
 * por "script dentro de un componente" (ver la guía de Next: preventing flash before hydration).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
