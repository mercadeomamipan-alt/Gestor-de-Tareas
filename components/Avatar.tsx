import type { Profile } from "@/lib/types";
import { initials, displayName } from "@/lib/people";

// Color estable por persona, a partir de su id
const HUES = [222, 160, 12, 280, 40, 190];
function hueFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({ p, size = 24 }: { p?: Profile; size?: number }) {
  const hue = p ? hueFor(p.id) : 220;
  return (
    <span
      className="avatar"
      title={displayName(p)}
      style={{ width: size, height: size, fontSize: size * 0.42, ["--h" as string]: hue }}
    >
      {initials(p)}
    </span>
  );
}

export function AvatarStack({ ids, profiles }: { ids: string[]; profiles: Record<string, Profile> }) {
  return (
    <span className="avatars">
      {ids.map((id) => (
        <Avatar key={id} p={profiles[id]} />
      ))}
    </span>
  );
}
