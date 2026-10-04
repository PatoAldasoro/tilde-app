import type { SessionUser } from "@/components/providers";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "?";
}

/** Avatar del perfil: la foto de Google si existe; si no, iniciales. */
export function Avatar({ user }: { user: SessionUser }) {
  return (
    <span className="avatar subj-cobalto" aria-hidden="true">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto de perfil externa, 36 px
        <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        initials(user.name)
      )}
    </span>
  );
}
