"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import {
  changeStatus,
  reviewTask,
  toggleRequirement,
  addNote,
  addLink,
  uploadFile,
  deleteTask,
  type FormState,
} from "@/app/tareas/actions";
import { STATUS, type Status } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

// ---------------------------------------------------------------- Estado

export function StatusControl({
  taskId,
  current,
  isAssigner,
  blockedReason,
}: {
  taskId: string;
  current: Status;
  isAssigner: boolean;
  blockedReason: string;
}) {
  const [state, action] = useActionState(changeStatus, undefined);
  const [picked, setPicked] = useState<Status | null>(null);
  const options: Status[] = ["pendiente", "en_curso", "bloqueada", isAssigner ? "hecha" : "en_revision", "cancelada"];
  const label = (s: Status) => (s === "en_revision" && !isAssigner ? "Terminé: enviar a revisión" : STATUS[s]);

  return (
    <form action={action} className="status-form">
      <input type="hidden" name="id" value={taskId} />
      <div className="status-buttons" role="group" aria-label="Cambiar estado">
        {options.map((s) => (
          <button
            key={s}
            type={s === "bloqueada" ? "button" : "submit"}
            name="status"
            value={s}
            aria-pressed={current === s}
            formNoValidate
            onClick={() => setPicked(s === "bloqueada" ? "bloqueada" : null)}
          >
            {label(s)}
          </button>
        ))}
      </div>
      {(picked === "bloqueada") && (
        <div className="addrow">
          <input
            className="input"
            name="blocked_reason"
            placeholder="¿Qué la bloquea o de quién depende?"
            defaultValue={blockedReason}
            required
            autoFocus
          />
          <SubmitButton className="btn" name="status" value="bloqueada" pendingText="…">Marcar bloqueada</SubmitButton>
        </div>
      )}
      {!isAssigner && (
        <p className="hint">Quien asignó la tarea la aprueba antes de quedar como hecha.</p>
      )}
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------- Aprobación

export function ReviewControl({ taskId }: { taskId: string }) {
  const [state, action] = useActionState(reviewTask, undefined);
  const [returning, setReturning] = useState(false);
  return (
    <form action={action} style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="id" value={taskId} />
      {returning ? (
        <>
          <input type="hidden" name="decision" value="devolver" />
          <textarea className="input" name="reason" placeholder="¿Qué falta o qué hay que corregir?" required autoFocus rows={3} />
          <div className="row-actions">
            <SubmitButton className="btn danger solid" pendingText="Devolviendo…">Devolver tarea</SubmitButton>
            <button type="button" className="btn ghost" onClick={() => setReturning(false)}>Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <input className="input" name="reason" placeholder="Comentario (opcional)" />
          <div className="row-actions">
            <SubmitButton className="btn ok" name="decision" value="aprobar" pendingText="Aprobando…">Aprobar</SubmitButton>
            <button type="button" className="btn" onClick={() => setReturning(true)}>Devolver con comentarios</button>
          </div>
        </>
      )}
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------- Requisito (casilla)

export function RequirementCheck({ id, taskId, done, label }: { id: string; taskId: string; done: boolean; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={optimistic}
      onChange={(e) => {
        const v = e.target.checked;
        start(async () => {
          setOptimistic(v);
          await toggleRequirement(id, taskId, v);
        });
      }}
    />
  );
}

// ---------------------------------------------------------------- Notas

export function NoteForm({ taskId }: { taskId: string }) {
  const [state, action] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addNote(prev, fd);
    if (!r?.error) (document.getElementById("note-body") as HTMLTextAreaElement | null)?.form?.reset();
    return r;
  }, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name="task_id" value={taskId} />
      <textarea id="note-body" name="body" className="input" rows={3} placeholder="Escribe un avance, una pregunta o un comentario…" required />
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-actions">
        <SubmitButton pendingText="Guardando…">Agregar nota</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Adjuntos

export function AttachmentForms({ taskId }: { taskId: string }) {
  const [linkState, linkAction] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addLink(prev, fd);
    if (!r?.error) (document.getElementById("link-url") as HTMLInputElement | null)?.form?.reset();
    return r;
  }, undefined);
  const [fileState, fileAction] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await uploadFile(prev, fd);
    if (!r?.error) (document.getElementById("file-input") as HTMLInputElement | null)?.form?.reset();
    return r;
  }, undefined);
  return (
    <details className="add">
      <summary>+ Agregar enlace o archivo</summary>
      <div style={{ display: "grid", gap: 14 }}>
        <form action={linkAction} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="task_id" value={taskId} />
          <div className="field">
            <label htmlFor="link-url">Enlace</label>
            <input id="link-url" name="url" type="url" inputMode="url" placeholder="https://drive.google.com/…" required className="input" />
          </div>
          <div className="addrow">
            <input name="name" type="text" placeholder="Nombre (opcional)" className="input" aria-label="Nombre del enlace" />
            <SubmitButton className="btn" pendingText="…">Agregar</SubmitButton>
          </div>
          {linkState?.error && <p className="form-error" role="alert">{linkState.error}</p>}
        </form>
        <form action={fileAction} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="task_id" value={taskId} />
          <div className="field">
            <label htmlFor="file-input">Archivo (máx. 10 MB)</label>
            <input id="file-input" name="file" type="file" required />
          </div>
          <div className="form-actions">
            <SubmitButton className="btn" pendingText="Subiendo…">Subir archivo</SubmitButton>
          </div>
          {fileState?.error && <p className="form-error" role="alert">{fileState.error}</p>}
        </form>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- Eliminar

export function DeleteTask({ taskId }: { taskId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return (
      <button type="button" className="btn ghost danger small" onClick={() => setConfirming(true)}>
        Eliminar tarea
      </button>
    );
  return (
    <form action={deleteTask} className="confirm">
      <input type="hidden" name="id" value={taskId} />
      <span>¿Eliminar para todos, con sus notas y adjuntos?</span>
      <SubmitButton className="btn danger solid small" pendingText="Eliminando…">Sí, eliminar</SubmitButton>
      <button type="button" className="btn ghost small" onClick={() => setConfirming(false)}>Cancelar</button>
    </form>
  );
}
