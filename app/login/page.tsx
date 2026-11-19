"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default function LoginPage() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <main className="login">
      <form action={action} className="login-card">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Mamipan" className="login-logo" width={240} height={180} />
          <span className="brand-name">Gestor de tareas</span>
        </div>
        <h1>Inicia sesión</h1>
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <SubmitButton className="btn primary block" pendingText="Entrando…">Entrar</SubmitButton>
        <p className="hint">¿Olvidaste tu contraseña? Pide a quien administra la app que te la restablezca.</p>
      </form>
    </main>
  );
}
