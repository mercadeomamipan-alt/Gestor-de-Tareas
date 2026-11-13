import Link from "next/link";
import { STATUS, PRIORITY, isOpen, type Profile, type TaskListItem } from "@/lib/types";
import { dueInfo } from "@/lib/dates";
import { AvatarStack } from "./Avatar";

export function TaskRow({
  t,
  profiles,
  isNew,
  unreadNotes,
}: {
  t: TaskListItem;
  profiles: Record<string, Profile>;
  isNew?: boolean;
  unreadNotes?: number;
}) {
  const open = isOpen(t.status);
  const d = dueInfo(t.due_date);
  return (
    <Link href={`/tareas/${t.id}`} className={`row p-${t.priority}${open ? "" : " closed"}`}>
      <span className="stripe" aria-hidden="true" />
      <span className="main">
        <span className="title">
          <span className="txt">{t.title}</span>
          {isNew && <span className="new-badge">Nueva</span>}
        </span>
        <span className="meta">
          <span className={`pill st-${t.status}`}>{STATUS[t.status]}</span>
          <span className={`prio prio-${t.priority}`}>Prioridad {PRIORITY[t.priority].toLowerCase()}</span>
          {t.assignees.length > 1 && <span className="tag shared">Compartida</span>}
          {t.project && <span className="tag project">{t.project}</span>}
          {t.req_total > 0 && (
            <span className="reqbar" title="Requisitos cumplidos">
              <span className="track">
                <span className="fill" style={{ width: `${Math.round((t.req_done / t.req_total) * 100)}%` }} />
              </span>
              <span className="mono">{t.req_done}/{t.req_total}</span>
            </span>
          )}
          {t.note_count > 0 && (
            <span>
              {t.note_count} nota{t.note_count > 1 ? "s" : ""}
              {unreadNotes ? <b style={{ color: "var(--accent)" }}> · {unreadNotes} nueva{unreadNotes > 1 ? "s" : ""}</b> : null}
            </span>
          )}
          {t.recurrence !== "ninguna" && <span>↻ {t.recurrence}</span>}
        </span>
      </span>
      <span className="right">
        <span className={`due ${open ? d.tone : ""}`}>{d.text}</span>
        <AvatarStack ids={t.assignees} profiles={profiles} />
      </span>
    </Link>
  );
}
