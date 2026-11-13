import type { Profile } from "@/lib/types";
import { initials, displayName, personHue } from "@/lib/people";


export function Avatar({ p, size = 24 }: { p?: Profile; size?: number }) {
  const hue = p ? personHue(p) : 220;
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
