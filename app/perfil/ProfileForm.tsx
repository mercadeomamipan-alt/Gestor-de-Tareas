"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/tareas/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="card">
      <div className="field">
        <label htmlFor="full_name">Nombre</label>
        <input id="full_name" name="full_name" type="text" defaultValue={name} required />
        <p className="hint">Así te ve la otra persona en las tareas y en los correos.</p>
      </div>
      <div className="field">
        <span className="lbl">Correo</span>
        <span>{email}</span>
        <p className="hint">Aquí te llegan los avisos y el resumen diario.</p>
      </div>
      <div className="field">
        <label htmlFor="password">Nueva contraseña <span className="optional">(déjala vacía para no cambiarla)</span></label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} />
      </div>
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="form-ok" role="status">{state.ok}</p>}
      <div className="form-actions">
        <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
      </div>
    </form>
  );
}
