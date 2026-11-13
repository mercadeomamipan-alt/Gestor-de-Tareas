import type { Profile } from "@/lib/types";

export function displayName(p: Profile | undefined, meId?: string): string {
  if (!p) return "Alguien";
  if (meId && p.id === meId) return "Tú";
  return p.full_name || p.email.split("@")[0];
}

export function initials(p: Profile | undefined): string {
  const n = (p?.full_name || p?.email || "?").trim();
  const parts = n.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
