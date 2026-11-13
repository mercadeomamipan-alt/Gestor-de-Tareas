import Link from "next/link";
import type { Profile } from "@/lib/types";
import { signOut } from "@/app/tareas/actions";
import { Avatar } from "./Avatar";
import { NavTabs } from "./NavTabs";

export function Header({ me }: { me: Profile }) {
  return (
    <header className="appbar">
      <div className="appbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Gestor de Tareas
        </Link>
        <NavTabs />
        <nav className="appbar-nav">
          <Link href="/tareas/nueva" className="btn primary">+ Nueva tarea</Link>
          <Link href="/perfil" className="me" title="Tu perfil">
            <Avatar p={me} size={28} />
            <span className="me-name">{me.full_name || me.email}</span>
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn ghost small">Salir</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
