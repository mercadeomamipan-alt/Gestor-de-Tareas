import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page narrow">
      <div className="empty">
        <h3>No encontramos esta tarea</h3>
        <p style={{ margin: 0 }}>Puede que la hayan eliminado o que el enlace esté incompleto.</p>
        <Link href="/" className="btn primary">Volver a las tareas</Link>
      </div>
    </main>
  );
}
