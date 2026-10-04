import { notFound } from "next/navigation";

/** Cualquier ruta desconocida cae en el 404 traducido. */
export default function CatchAll() {
  notFound();
}
