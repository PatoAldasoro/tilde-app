"use client";

import { createContext, useContext } from "react";

/**
 * Dónde se dibujan los globos (popovers) abiertos desde un diálogo: adentro del diálogo y no al
 * final de la página. El diálogo bloquea la rueda, el touchpad y el dedo en todo lo que está fuera
 * de él; un globo afuera no se podía desplazar (la grilla de íconos, la lista de horas).
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = () => useContext(PortalContainerContext);
