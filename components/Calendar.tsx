"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { rescheduleTask } from "@/app/tareas/actions";
import { rescheduleEvent } from "@/app/eventos/actions";
import {
  addDays,
  addMonths,
  daysUntil,
  fmtDate,
  fmtDay,
  fmtLongDay,
  fmtMonthYear,
  fmtTime,
  fmtWeekdayShort,
  isoWeek,
  startOfWeek,
} from "@/lib/dates";
import { displayName, personHue } from "@/lib/people";
import { EVENT_KIND, isOpen, STATUS, type EventListItem, type Profile, type TaskListItem } from "@/lib/types";
import { TaskRow } from "./TaskRow";
import { EventRow } from "./EventRow";
import { SubmitButton } from "./SubmitButton";

export type View = "mes" | "semana" | "dia";

type Props = {
  view: View;
  anchor: string;
  today: string;
  from: string;
  to: string;
  tasks: TaskListItem[];
  events: EventListItem[];
  overdue: TaskListItem[];
  noDateCount: number;
  profiles: Record<string, Profile>;
  meId: string;
  query: { quien: string; proyecto: string };
};

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MAX_CHIPS = 4;

export function Calendar(props: Props) {
  const { view, anchor, today, from, to, tasks, events, overdue, noDateCount, profiles, meId, query } = props;
  const [, startMove] = useTransition();
  const [moving, setMoving] = useState<{ task: TaskListItem; date: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);
  const closeMove = useCallback(() => setMoving(null), []);

  const href = (patch: Partial<{ vista: View; fecha: string }>) => {
    const p = new URLSearchParams();
    const vista = patch.vista ?? view;
    const fecha = patch.fecha ?? anchor;
    if (vista !== "mes") p.set("vista", vista);
    if (fecha !== today) p.set("fecha", fecha);
    if (query.quien) p.set("quien", query.quien);
    if (query.proyecto) p.set("proyecto", query.proyecto);
    return `/calendario${p.size ? "?" + p : ""}`;
  };
  const step = (dir: 1 | -1) =>
    view === "mes" ? addMonths(anchor.slice(0, 8) + "01", dir) : addDays(anchor, view === "semana" ? 7 * dir : dir);

  const byDate: Record<string, TaskListItem[]> = {};
  for (const t of tasks) (byDate[t.due_date!] ??= []).push(t);
  const PRIO = { alta: 0, media: 1, baja: 2 } as const;
  for (const list of Object.values(byDate))
    list.sort((a, b) => Number(!isOpen(a.status)) - Number(!isOpen(b.status)) || PRIO[a.priority] - PRIO[b.priority]);

  const evByDate: Record<string, EventListItem[]> = {};
  for (const e of events) (evByDate[e.event_date] ??= []).push(e);

  const openCount = (d: string) => (byDate[d] ?? []).filter((t) => isOpen(t.status)).length;
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const maxLoad = Math.max(1, ...days.map(openCount));

  // Carga por persona en el período (solo tareas abiertas; una compartida cuenta para cada responsable)
  const people = Object.values(profiles);
  const perPerson = people
    .map((p) => ({ p, n: tasks.filter((t) => isOpen(t.status) && t.assignees.includes(p.id)).length }))
    .sort((a, b) => b.n - a.n);
  const maxPerson = Math.max(1, ...perPerson.map((x) => x.n));
  const totalOpen = tasks.filter((t) => isOpen(t.status)).length;
  const totalDone = tasks.length - totalOpen;
  const evCount = (d: string) => (evByDate[d] ?? []).length;

  const title =
    view === "mes"
      ? fmtMonthYear(anchor)
      : view === "semana"
        ? `Semana ${isoWeek(from)} · ${fmtDay(from)} – ${fmtDay(to)}`
        : fmtLongDay(anchor);

  // ---------- arrastrar y soltar (solo computador) ----------
  const canDrag = (t: TaskListItem) => isOpen(t.status);
  const dropProps = (date: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (overDate !== date) setOverDate(date);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOverDate(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/item-id") || dragId || "";
      setOverDate(null);
      setDragId(null);
      if (id.startsWith("e:")) {
        const ev = events.find((x) => x.id === id.slice(2));
        if (ev && ev.event_date !== date) {
          const fd = new FormData();
          fd.set("id", ev.id);
          fd.set("event_date", date);
          startMove(async () => {
            await rescheduleEvent(undefined, fd);
          });
        }
        return;
      }
      const task = tasks.find((t) => t.id === id.slice(2));
      if (task && task.due_date !== date) setMoving({ task, date });
    },
  });

  const Chip = ({ t }: { t: TaskListItem }) => {
    const id1 = t.assignees[0] ?? t.assigned_by;
    const h1 = personHue(profiles[id1], id1);
    const h2 = t.assignees[1] ? personHue(profiles[t.assignees[1]], t.assignees[1]) : h1;
    const late = isOpen(t.status) && t.due_date! < today;
    const who = t.assignees.map((a) => displayName(profiles[a])).join(" y ");
    return (
      <Link
        href={`/tareas/${t.id}`}
        className={`chip${isOpen(t.status) ? "" : " closed"}${late ? " late" : ""}${t.assignees.length > 1 ? " shared" : ""}${dragId === "t:" + t.id ? " dragging" : ""}`}
        style={{ ["--h" as string]: h1, ["--h2" as string]: h2 }}
        title={`${t.title} · ${who} · ${STATUS[t.status]}${late ? " · vencida" : ""}`}
        draggable={canDrag(t)}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/item-id", "t:" + t.id);
          e.dataTransfer.effectAllowed = "move";
          setDragId("t:" + t.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverDate(null);
        }}
      >
        <span className="chip-title">{t.title}</span>
      </Link>
    );
  };

  const EventChip = ({ e }: { e: EventListItem }) => {
    const who = e.participants.map((a) => displayName(profiles[a])).join(" y ");
    return (
      <Link
        href={`/eventos/${e.id}`}
        className={`chip event${e.event_date < today ? " closed-ev" : ""}${dragId === "e:" + e.id ? " dragging" : ""}`}
        title={`${EVENT_KIND[e.kind]}: ${e.title} · ${e.start_time ? fmtTime(e.start_time) : "todo el día"} · ${who}`}
        draggable
        onDragStart={(ev) => {
          ev.dataTransfer.setData("text/item-id", "e:" + e.id);
          ev.dataTransfer.effectAllowed = "move";
          setDragId("e:" + e.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverDate(null);
        }}
      >
        <span className="chip-title">
          <span className="ev-clock" aria-hidden="true" />
          {e.start_time && <span className="ev-t">{fmtTime(e.start_time).replace(/ ?([ap])\. m\./, "$1")}</span>}
          {e.title}
        </span>
      </Link>
    );
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <div className="cal-nav">
          <Link href={href({ fecha: step(-1) })} className="btn small" aria-label="Anterior">←</Link>
          <Link href={href({ fecha: today })} className="btn small">Hoy</Link>
          <Link href={href({ fecha: step(1) })} className="btn small" aria-label="Siguiente">→</Link>
          <h1 className="cal-title">{title}</h1>
        </div>
        <div className="seg" role="group" aria-label="Vista">
          {(
            [
              ["mes", "Mes"],
              ["semana", "Semana"],
              ["dia", "Día"],
            ] as const
          ).map(([v, l]) => (
            <Link key={v} href={href({ vista: v })} aria-current={view === v ? "true" : undefined}>
              {l}
            </Link>
          ))}
        </div>
      </div>

      {view !== "dia" && (
        <section className="load" aria-label="Distribución de la carga">
          <div className="load-total">
            <span className="n">{totalOpen}</span>
            <span className="l">
              abiertas que vencen en este {view === "mes" ? "mes" : "período"}
              {totalDone > 0 && <> · {totalDone} cerradas</>}
              {noDateCount > 0 && <> · {noDateCount} sin fecha</>}
              {events.length > 0 && <> · {events.length} evento{events.length > 1 ? "s" : ""}</>}
            </span>
          </div>
          <ul className="load-people">
            {perPerson.map(({ p, n }) => (
              <li key={p.id} style={{ ["--h" as string]: personHue(p) }}>
                <span className="who">
                  <span className="swatch" aria-hidden="true" />
                  {displayName(p)}
                  {p.id === meId && <span className="muted"> (tú)</span>}
                </span>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${(n / maxPerson) * 100}%` }} />
                </span>
                <span className="mono">{n}</span>
              </li>
            ))}
          </ul>
          <p className="hint drag-hint">Arrastra una tarea o un evento a otro día para cambiar su fecha.</p>
        </section>
      )}

      {view === "mes" && (
        <div className="cal-month" role="grid" aria-label={title}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="month-wd" role="columnheader">{w}</div>
          ))}
          {days.map((d) => {
            const list = byDate[d] ?? [];
            const evs = evByDate[d] ?? [];
            const n = openCount(d);
            const shownEv = evs.slice(0, MAX_CHIPS);
            const shownTasks = list.slice(0, Math.max(0, MAX_CHIPS - shownEv.length));
            const hidden = evs.length + list.length - shownEv.length - shownTasks.length;
            const outside = d.slice(0, 7) !== anchor.slice(0, 7);
            return (
              <div
                key={d}
                role="gridcell"
                className={`day${outside ? " outside" : ""}${d === today ? " today" : ""}${overDate === d ? " drop" : ""}`}
                {...dropProps(d)}
              >
                <div className="day-top">
                  <Link href={href({ vista: "dia", fecha: d })} className="day-num" aria-label={`Ver ${fmtLongDay(d)}`}>
                    {Number(d.slice(8))}
                  </Link>
                  {n > 0 && <span className="day-count mono">{n}</span>}
                </div>
                <div className="day-load" aria-hidden="true">
                  <span style={{ width: `${(n / maxLoad) * 100}%` }} />
                </div>
                <div className="day-chips">
                  {shownEv.map((e) => (
                    <EventChip key={e.id} e={e} />
                  ))}
                  {shownTasks.map((t) => (
                    <Chip key={t.id} t={t} />
                  ))}
                  {hidden > 0 && (
                    <Link href={href({ vista: "dia", fecha: d })} className="more">
                      +{hidden} más
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "semana" && (
        <div className="cal-week">
          {days.map((d) => {
            const list = byDate[d] ?? [];
            const n = openCount(d);
            return (
              <div
                key={d}
                className={`wday${d === today ? " today" : ""}${overDate === d ? " drop" : ""}`}
                {...dropProps(d)}
              >
                <Link href={href({ vista: "dia", fecha: d })} className="wday-head">
                  <span className="wd">{fmtWeekdayShort(d)}</span>
                  <span className="dn">{Number(d.slice(8))}</span>
                  <span className="wc mono">
                    {n || evCount(d)
                      ? [evCount(d) ? `${evCount(d)} ev.` : "", n ? `${n} ${n === 1 ? "tarea" : "tareas"}` : ""].filter(Boolean).join(" · ")
                      : "libre"}
                  </span>
                </Link>
                <div className="day-load" aria-hidden="true">
                  <span style={{ width: `${(n / maxLoad) * 100}%` }} />
                </div>
                <div className="day-chips">
                  {(evByDate[d] ?? []).map((e) => (
                    <EventChip key={e.id} e={e} />
                  ))}
                  {list.map((t) => (
                    <Chip key={t.id} t={t} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "dia" && (
        <div className="groups">
          {(evByDate[anchor] ?? []).length > 0 && (
            <section className="group">
              <header>
                <h2>Eventos {anchor === today ? "de hoy" : `del ${fmtDate(anchor)}`}</h2>
                <span className="count">{evByDate[anchor].length}</span>
              </header>
              <div className="list">
                {evByDate[anchor].map((e) => (
                  <EventRow key={e.id} e={e} profiles={profiles} showDate={false} />
                ))}
              </div>
            </section>
          )}
          {overdue.length > 0 && (
            <section className="group late">
              <header>
                <h2>Vencidas y aún abiertas</h2>
                <span className="count">{overdue.length}</span>
              </header>
              <div className="list">
                {overdue.map((t) => (
                  <TaskRow key={t.id} t={t} profiles={profiles} />
                ))}
              </div>
            </section>
          )}
          <section className="group">
            <header>
              <h2>Vencen {anchor === today ? "hoy" : `el ${fmtDate(anchor)}`}</h2>
              <span className="count">{tasks.length}</span>
            </header>
            {tasks.length === 0 ? (
              <div className="empty">
                <h3>Nada vence este día</h3>
                <p style={{ margin: 0 }}>
                  {daysUntil(anchor, today) >= 0 ? "Día libre para adelantar trabajo." : "No hubo entregas este día."}
                </p>
              </div>
            ) : (
              <div className="list">
                {byDate[anchor]?.map((t) => (
                  <TaskRow key={t.id} t={t} profiles={profiles} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {moving && (
        <MoveDialog
          key={moving.task.id + moving.date}
          task={moving.task}
          date={moving.date}
          onClose={closeMove}
        />
      )}
    </div>
  );
}

function MoveDialog({ task, date, onClose }: { task: TaskListItem; date: string; onClose: () => void }) {
  const [state, action] = useActionState(rescheduleTask, undefined);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <form
        action={action}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="move-title">Mover la entrega</h2>
        <p style={{ margin: 0 }}>
          <b>{task.title}</b>
          <br />
          <span className="muted">
            {task.due_date ? fmtDate(task.due_date) : "Sin fecha"} → <b style={{ color: "var(--fg)" }}>{fmtDate(date)}</b>
          </span>
        </p>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="due_date" value={date} />
        <div className="field">
          <label htmlFor="move-reason">Motivo del cambio</label>
          <textarea
            ref={ref}
            id="move-reason"
            name="reason"
            rows={3}
            required={!!task.due_date}
            placeholder="Ej. Se adelantó la reunión con el cliente"
          />
          <p className="hint">Queda en el historial y se avisa por correo a los responsables.</p>
        </div>
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <SubmitButton pendingText="Moviendo…">Mover tarea</SubmitButton>
        </div>
      </form>
    </div>
  );
}
