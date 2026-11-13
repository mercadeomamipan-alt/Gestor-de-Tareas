import type { Profile } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function displayName(p: Profile | undefined, _meId?: string): string {
  if (!p) return "Alguien";
  return p.full_name || p.email.split("@")[0];
}

export function initials(p: Profile | undefined): string {
  const n = (p?.full_name || p?.email || "?").trim();
  const parts = n.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
