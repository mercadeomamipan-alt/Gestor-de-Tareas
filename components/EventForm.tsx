"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { EVENT_KIND, RECURRENCE, type EventListItem, type Profile } from "@/lib/types";
import type { EventFormState } from "@/app/eventos/actions";
import { Avatar } from "./Avatar";

type Props = {
  mode: "crear" | "editar";
  action: (prev: EventFormState, fd: FormData) => Promise<EventFormState>;
  people: Profile[];
  meId: string;
  event?: EventListItem;
  defaults?: { date?: string; taskId?: string; taskTitle?: string; participants?: string[] };
};

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function EventForm({ mode, action, people, meId, event, defaults }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [allDay, setAllDay] = useState(event ? !event.start_time : false);
  const chosen = new Set(event?.participants ?? defaults?.participants ?? people.map((p) => p.id));
  const nameOf = (p: Profile) => (p.id === meId ? `${p.full_name || p.email} (tú)` : p.full_name || p.email);

  return (
    <form
      className="card"
      style={{ gap: 18 }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {event && <input type="hidden" name="id" value={event.id} />}
      {defaults?.taskId && <input type="hidden" name="task_id" value={defaults.taskId} />}
      {defaults?.taskTitle && (
        <p className="hint">
          Se vinculará la tarea <b>{defaults.taskTitle}</b> a este evento.
        </p>
      )}

      <div className="grid2">
        <div className="field">
          <label htmlFor="ev-title">Nombre</label>
          <input id="ev-title" name="title" type="text" required defaultValue={event?.title} placeholder="Ej. Reunión con distribuidor" autoFocus={mode === "crear"} />
        </div>
        <div className="field">
          <label htmlFor="ev-kind">Tipo</label>
          <select id="ev-kind" name="kind" defaultValue={event?.kind ?? "reunion"}>
            {Object.entries(EVENT_KIND).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid3">
        <div className="field">
          <label htmlFor="ev-date">Fecha</label>
          <input id="ev-date" name="event_date" type="date" required defaultValue={event?.event_date ?? defaults?.date ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="ev-start">Hora de inicio</label>
          <input id="ev-start" name="start_time" type="time" disabled={allDay} defaultValue={hhmm(event?.start_time) || "09:00"} />
        </div>
        <div className="field">
          <label htmlFor="ev-end">Hora de fin</label>
          <input id="ev-end" name="end_time" type="time" disabled={allDay} defaultValue={hhmm(event?.end_time) || "10:00"} />
        </div>
      </div>
      <label className="check-line">
        <input type="checkbox" name="all_day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        Todo el día
      </label>

      <div className="field">
        <label htmlFor="ev-location">Lugar o enlace <span className="optional">(opcional)</span></label>
        <input id="ev-location" name="location" type="text" defaultValue={event?.location} placeholder="Sala de juntas, dirección o link de Meet / Zoom / Teams" />
      </div>

      <div className="field">
        <span className="lbl">Participantes</span>
        <div className="chips">
          {people.map((p) => (
            <label key={p.id} className="chip-check">
              <input type="checkbox" name="participants" value={p.id} defaultChecked={chosen.has(p.id)} />
              <span>
                <Avatar p={p} size={24} />
                {nameOf(p)}
              </span>
            </label>
          ))}
        </div>
        <p className="hint">A quien agregues le llega un correo con la invitación.</p>
      </div>

      <div className="field">
        <label htmlFor="ev-desc">Agenda o descripción <span className="optional">(opcional)</span></label>
        <textarea id="ev-desc" name="description" defaultValue={event?.description} placeholder={"Temas a tratar:\n1. Precios de temporada\n2. Fechas de entrega"} />
      </div>

      <div className="field">
        <label htmlFor="ev-rec">Repetición</label>
        <select id="ev-rec" name="recurrence" defaultValue={event?.recurrence ?? "ninguna"}>
          {Object.entries(RECURRENCE).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <p className="hint">Siempre verás la próxima en el calendario. Cada repetición tiene sus propias notas y tareas.</p>
      </div>

      {state?.error && <p className="form-error" role="alert">{state.error}</p>}

      <div className="form-actions">
        <Link href={event ? `/eventos/${event.id}` : "/eventos"} className="btn">Cancelar</Link>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Guardando…" : mode === "crear" ? "Crear evento" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
