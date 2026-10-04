/** Logo de Tilde (propio, no es de Lucide): símbolo + wordmark en trazos SVG. */

export function LogoSymbol({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="6.5" fill="var(--color-accent)" />
      <path
        d="M5 13.2C6.3 10.6 8.3 10.4 9.9 12.6L11.6 15C12.1 15.7 12.9 15.7 13.4 15L18.9 7.4"
        fill="none"
        stroke="var(--color-on-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Wordmark() {
  return (
    <svg className="wordmark" viewBox="0 0 64 28" width="51" height="22" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4V19.5a4.5 4.5 0 0 0 4.5 4.5H9" />
        <path d="M0.5 10.5H8.5" />
        <path d="M15 11V24" />
        <path d="M21.5 2V19.5a4.5 4.5 0 0 0 4.5 4.5" />
        <circle cx="36" cy="17.5" r="6.5" />
        <path d="M42.5 2V24" />
        <path d="M48.5 17.5H61.5a6.5 6.5 0 1 0-1.6 4.3" />
      </g>
      <circle cx="15" cy="4.6" r="2" fill="currentColor" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoSymbol size={size} />
      <Wordmark />
      <span className="visually-hidden">Tilde</span>
    </span>
  );
}
