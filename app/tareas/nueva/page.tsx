import Link from "next/link";
import { Header } from "@/components/Header";
import { TaskForm } from "@/components/TaskForm";
import { requireUser, getProfiles } from "@/lib/data";
import { getEvent } from "@/lib/events";
import { createTask } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireUser();
  const profiles = await getProfiles(supabase);
  const { data: proj } = await supabase.from("tasks").select("project").neq("project", "");
  const projects = [...new Set((proj ?? []).map((p) => p.project as string))].sort((a, b) => a.localeCompare(b, "es"));
  // Crear una tarea desde un evento: queda vinculada, con los participantes como responsables
  const ev = sp.evento && /^[0-9a-f-]{36}$/i.test(sp.evento) ? await getEvent(supabase, sp.evento) : null;
  const defaults = ev ? { eventId: ev.id, eventTitle: ev.title, assignees: ev.participants, due: ev.event_date } : undefined;
  return (
    <>
      <Header me={me} />
      <main className="page narrow">
        <div className="crumbs">{ev ? <Link href={`/eventos/${ev.id}`}>← {ev.title}</Link> : <Link href="/">← Tareas</Link>}</div>
        <h1 style={{ fontSize: 28 }}>Nueva tarea</h1>
        <TaskForm mode="crear" action={createTask} people={Object.values(profiles)} meId={me.id} projects={projects} defaults={defaults} />
      </main>
    </>
  );
}
