"use client";

import { useActionState, useState } from "react";
import { saveNotes, deleteEvent } from "@/app/eventos/actions";
import { SubmitButton } from "./SubmitButton";

export function NotesForm({ eventId, notes }: { eventId: string; notes: string }) {
  const [state, action] = useActionState(saveNotes, undefined);
  const [dirty, setDirty] = useState(false);
  return (
    <form
      action={async (fd) => {
        await action(fd);
        setDirty(false);
      }}
      style={{ display: "grid", gap: 8 }}
    >
      <input type="hidden" name="id" value={eventId} />
      <textarea
        id="ev-notes"
        name="notes"
        className="input"
        rows={6}
        defaultValue={notes}
        onChange={() => setDirty(true)}
        placeholder={"Qué se habló, qué se decidió y quién hace qué.\nEj.: Se aprueba el precio de temporada. Ana envía la cotización el viernes."}
        aria-label="Notas o acta"
      />
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-actions" style={{ alignItems: "center" }}>
        {state?.ok && !dirty && <span className="hint">Notas guardadas.</span>}
        <SubmitButton className="btn" pendingText="Guardando…">Guardar notas</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteEvent({ eventId, recurring }: { eventId: string; recurring: boolean }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return (
      <button type="button" className="btn ghost danger small" onClick={() => setConfirming(true)}>
        Eliminar evento
      </button>
    );
  return (
    <form action={deleteEvent} className="confirm">
      <input type="hidden" name="id" value={eventId} />
      <span>
        ¿Eliminar este evento para todos? Las tareas vinculadas no se borran.
        {recurring && " Para que deje de repetirse, mejor edítalo y elige “No se repite”."}
      </span>
      <SubmitButton className="btn danger solid small" pendingText="Eliminando…">Sí, eliminar</SubmitButton>
      <button type="button" className="btn ghost small" onClick={() => setConfirming(false)}>Cancelar</button>
    </form>
  );
}
