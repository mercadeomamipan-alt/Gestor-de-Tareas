import Link from "next/link";
import { EVENT_KIND, type EventListItem, type Profile } from "@/lib/types";
import { fmtDay, fmtTimeRange } from "@/lib/dates";
import { AvatarStack } from "./Avatar";

export function EventRow({ e, profiles, showDate = true }: { e: EventListItem; profiles: Record<string, Profile>; showDate?: boolean }) {
  return (
    <Link href={`/eventos/${e.id}`} className="ev-row">
      <span className="ev-when">
        {showDate && <span className="ev-day">{fmtDay(e.event_date)}</span>}
        <span className="ev-time mono">{fmtTimeRange(e.start_time, e.end_time)}</span>
      </span>
      <span className="main">
        <span className="title">{e.title}</span>
        <span className="meta">
          <span className={`kind kind-${e.kind}`}>{EVENT_KIND[e.kind]}</span>
          {e.location && <span className="ev-loc">{e.location}</span>}
          {e.task_count > 0 && <span>{e.task_count} tarea{e.task_count > 1 ? "s" : ""}</span>}
          {e.recurrence !== "ninguna" && <span>↻ {e.recurrence}</span>}
        </span>
      </span>
      <AvatarStack ids={e.participants} profiles={profiles} />
    </Link>
  );
}
