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
  recurring = false,
  blockedReason,
}: {
  taskId: string;
  current: Status;
  isAssigner: boolean;
  recurring?: boolean;
  blockedReason: string;
}) {
  const [state, action] = useActionState(changeStatus, undefined);
  const [blocking, setBlocking] = useState(false);
  const canClose = isAssigner || recurring;
  const options: Status[] = ["pendiente", "en_curso", "bloqueada", canClose ? "hecha" : "en_revision", "cancelada"];
  const label = (s: Status) => (s === "en_revision" && !canClose ? "Terminé: enviar a revisión" : STATUS[s]);

  return (
    <div className="status-form">
      <div className="status-buttons" role="group" aria-label="Cambiar estado">
        {options.map((s) =>
          s === "bloqueada" ? (
            <button key={s} type="button" aria-pressed={current === s} onClick={() => setBlocking(true)}>
              {label(s)}
            </button>
          ) : (
            <form key={s} action={action}>
              <input type="hidden" name="id" value={taskId} />
              <input type="hidden" name="status" value={s} />
              <button type="submit" aria-pressed={current === s} onClick={() => setBlocking(false)}>
                {label(s)}
              </button>
            </form>
          ),
        )}
      </div>
      {blocking && (
        <form action={action} className="addrow">
          <input type="hidden" name="id" value={taskId} />
          <input type="hidden" name="status" value="bloqueada" />
          <input
            className="input"
            name="blocked_reason"
            placeholder="¿Qué la bloquea o de quién depende?"
            defaultValue={blockedReason}
            aria-label="Motivo del bloqueo"
            required
            autoFocus
          />
          <SubmitButton className="btn" pendingText="…">Marcar bloqueada</SubmitButton>
        </form>
      )}
      {!canClose && <p className="hint">Quien asignó la tarea la aprueba antes de quedar como hecha.</p>}
      {recurring && !isAssigner && <p className="hint">Es una tarea repetitiva: se cierra sin aprobación.</p>}
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Aprobación

export function ReviewControl({ taskId }: { taskId: string }) {
  const [state, action] = useActionState(reviewTask, undefined);
  const [returning, setReturning] = useState(false);
  return (
    <form action={action} style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="id" value={taskId} />
      <input type="hidden" name="decision" value={returning ? "devolver" : "aprobar"} />
      {returning ? (
        <>
          <textarea className="input" name="reason" placeholder="¿Qué falta o qué hay que corregir?" aria-label="Qué falta" required autoFocus rows={3} />
          <div className="row-actions">
            <SubmitButton className="btn danger solid" pendingText="Devolviendo…">Devolver tarea</SubmitButton>
            <button type="button" className="btn ghost" onClick={() => setReturning(false)}>Cancelar</button>
          </div>
        </>
      ) : (
        <>
          <input className="input" name="reason" placeholder="Comentario (opcional)" aria-label="Comentario" />
          <div className="row-actions">
            <SubmitButton className="btn ok" pendingText="Aprobando…">Aprobar</SubmitButton>
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
            <input id="link-url" name="url" type="text" inputMode="url" autoComplete="url" placeholder="https://drive.google.com/…" required className="input" />
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
