import type { ReactNode } from "react";

type EmptyProps = { icon: ReactNode; title: string; text?: string; children?: ReactNode };

/** Estado vacío: ícono de 32, título en serif y una frase. */
export function Empty({ icon, title, text, children }: EmptyProps) {
  return (
    <div className="empty">
      <span className="subtle">{icon}</span>
      <h2 className="empty-title">{title}</h2>
      {text ? <p className="empty-text">{text}</p> : null}
      {children}
    </div>
  );
}
