"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PRIORITY, RECURRENCE, type Profile, type Task } from "@/lib/types";
import type { FormState } from "@/app/tareas/actions";
import { SubmitButton } from "./SubmitButton";
import { Avatar } from "./Avatar";

type Props = {
  mode: "crear" | "editar";
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  people: Profile[];
  meId: string;
  projects: string[];
  task?: Task & { assignees: string[] };
};

export function TaskForm({ mode, action, people, meId, projects, task }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [due, setDue] = useState(task?.due_date ?? "");
  const originalDue = task?.due_date ?? "";
  const needsReason = mode === "editar" && !!originalDue && due !== originalDue;
  const assigned = new Set(task?.assignees ?? [meId]);
  const nameOf = (p: Profile) => (p.id === meId ? `${p.full_name || p.email} (tú)` : p.full_name || p.email);

  return (
    <form action={formAction} className="card" style={{ gap: 18 }}>
      {task && <input type="hidden" name="id" value={task.id} />}

      <div className="field">
        <label htmlFor="title">Tarea</label>
        <input id="title" name="title" type="text" required defaultValue={task?.title} placeholder="¿Qué hay que hacer?" autoFocus={mode === "crear"} />
      </div>

      <div className="field">
        <label htmlFor="description">Descripción <span className="optional">(opcional)</span></label>
        <textarea id="description" name="description" defaultValue={task?.description} placeholder="Contexto, alcance, a quién va dirigido…" />
      </div>

      <div className="field">
        <span className="lbl">Responsables</span>
        <div className="chips">
          {people.map((p) => (
            <label key={p.id} className="chip-check">
              <input type="checkbox" name="assignees" value={p.id} defaultChecked={assigned.has(p.id)} />
              <span>
                <Avatar p={p} size={24} />
                {nameOf(p)}
              </span>
            </label>
          ))}
        </div>
        <p className="hint">Con dos o más responsables la tarea queda como compartida.</p>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="assigned_by">Asignada por</label>
          <select id="assigned_by" name="assigned_by" defaultValue={task?.assigned_by ?? meId}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{nameOf(p)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="project">Proyecto o área <span className="optional">(opcional)</span></label>
          <input id="project" name="project" type="text" list="projects" defaultValue={task?.project} placeholder="Ej. Lanzamiento navidad" />
          <datalist id="projects">
            {projects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid4">
        <div className="field">
          <label htmlFor="start_date">Fecha de inicio</label>
          <input id="start_date" name="start_date" type="date" defaultValue={task?.start_date ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="due_date">Fecha de entrega</label>
          <input id="due_date" name="due_date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="priority">Prioridad</label>
          <select id="priority" name="priority" defaultValue={task?.priority ?? "media"}>
            {Object.entries(PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="estimated_hours">Horas estimadas</label>
          <input id="estimated_hours" name="estimated_hours" type="number" min="0" step="0.5" inputMode="decimal" defaultValue={task?.estimated_hours ?? ""} placeholder="—" />
        </div>
      </div>

      {needsReason && (
        <div className="field">
          <label htmlFor="due_reason">Motivo del cambio de fecha</label>
          <input id="due_reason" name="due_reason" type="text" required placeholder="Ej. El proveedor entrega el material el jueves" />
          <p className="hint">Queda en el historial y se avisa por correo a los responsables.</p>
        </div>
      )}

      <div className="field">
        <label htmlFor="recurrence">Repetición</label>
        <select id="recurrence" name="recurrence" defaultValue={task?.recurrence ?? "ninguna"}>
          {Object.entries(RECURRENCE).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <p className="hint">Al cerrarla como hecha se crea sola la siguiente, con las fechas corridas y los mismos requisitos.</p>
      </div>

      {mode === "crear" && (
        <div className="field">
          <label htmlFor="requirements">Requisitos y entregables <span className="optional">(uno por línea)</span></label>
          <textarea id="requirements" name="requirements" placeholder={"Piezas para redes aprobadas\nPresupuesto enviado a compras\nInforme final en PDF"} />
        </div>
      )}

      {state?.error && <p className="form-error" role="alert">{state.error}</p>}

      <div className="form-actions">
        <Link href={task ? `/tareas/${task.id}` : "/"} className="btn">Cancelar</Link>
        <SubmitButton pendingText="Guardando…">{mode === "crear" ? "Crear tarea" : "Guardar cambios"}</SubmitButton>
      </div>
    </form>
  );
}
