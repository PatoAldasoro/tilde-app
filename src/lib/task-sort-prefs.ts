"use client";

import { useSyncExternalStore } from "react";
import { isTaskSort, type TaskSort } from "@/lib/domain/tasks";

/**
 * El criterio con el que se mira la lista de tareas. Se guarda en este dispositivo: es una forma
 * de mirar, no un dato de las tareas (el orden propio sí vive en la base, en `sort_order`).
 */
const STORAGE_KEY = "tilde-task-sort";
const listeners = new Set<() => void>();

function read(): TaskSort {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTaskSort(stored) ? stored : "manual";
  } catch {
    return "manual";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setTaskSort(sort: TaskSort) {
  try {
    localStorage.setItem(STORAGE_KEY, sort);
  } catch {
    // Sin almacenamiento: vale hasta recargar.
  }
  listeners.forEach((listener) => listener());
}

export function useTaskSort(): TaskSort {
  return useSyncExternalStore(subscribe, read, () => "manual");
}
