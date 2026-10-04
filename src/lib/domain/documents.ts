/**
 * Documentos de una materia: se guardan como referencias (nombre, URL, id de Drive, tipo),
 * nunca el archivo.
 */

export type DocumentKind = "doc" | "sheet" | "slides" | "image" | "pdf" | "folder" | "file" | "link";

const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export type DriveLink = { url: string; driveFileId: string | null; kind: DocumentKind };

/** Valida que sea un link de Google Drive o Docs y extrae lo que se pueda saber de él. */
export function parseDriveLink(input: string): DriveLink | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !DRIVE_HOSTS.has(url.hostname)) return null;

  const path = url.pathname;
  const idMatch = /\/(?:d|folders)\/([\w-]{10,})/.exec(path);
  const driveFileId = idMatch?.[1] ?? url.searchParams.get("id");
  return { url: url.toString(), driveFileId: driveFileId || null, kind: kindFromUrl(url) };
}

function kindFromUrl(url: URL): DocumentKind {
  const path = url.pathname;
  if (url.hostname === "docs.google.com") {
    if (path.startsWith("/document")) return "doc";
    if (path.startsWith("/spreadsheets")) return "sheet";
    if (path.startsWith("/presentation")) return "slides";
    return "file";
  }
  if (path.includes("/folders/")) return "folder";
  return "file";
}

/** Tipo de documento para elegir el ícono: primero por MIME (viene del Picker), después por la URL. */
export function documentKind(doc: { url: string; mime_type: string | null }): DocumentKind {
  const mime = doc.mime_type ?? "";
  if (mime === "application/vnd.google-apps.document" || mime.includes("wordprocessingml") || mime === "application/msword") return "doc";
  if (mime === "application/vnd.google-apps.spreadsheet" || mime.includes("spreadsheetml") || mime === "text/csv") return "sheet";
  if (mime === "application/vnd.google-apps.presentation" || mime.includes("presentationml")) return "slides";
  if (mime === "application/vnd.google-apps.folder") return "folder";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime) return "file";
  try {
    const url = new URL(doc.url);
    return DRIVE_HOSTS.has(url.hostname) ? kindFromUrl(url) : "link";
  } catch {
    return "link";
  }
}
