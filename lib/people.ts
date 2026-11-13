import type { Profile } from "@/lib/types";

export function displayName(p: Profile | undefined, _meId?: string): string {
  if (!p) return "Alguien";
  return p.full_name || p.email.split("@")[0];
}

export function initials(p: Profile | undefined): string {
  const n = (p?.full_name || p?.email || "?").trim();
  const parts = n.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Tonos de color por persona, en orden de llegada al equipo: azul, verde, morado, ámbar, turquesa, naranja (ninguno rojo, que es "vencida")
export const PERSON_HUES = [222, 152, 280, 44, 188, 22];

/** Color de respaldo cuando no se conoce el orden de la persona. */
export function hueFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PERSON_HUES[h % PERSON_HUES.length];
}

export const personHue = (p: Profile | undefined, fallbackId = "") => p?.hue ?? hueFor(p?.id ?? fallbackId);
