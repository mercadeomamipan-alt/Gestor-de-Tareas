import Link from "next/link";
import { Header } from "@/components/Header";
import { TaskForm } from "@/components/TaskForm";
import { requireUser, getProfiles } from "@/lib/data";
import { createTask } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const { supabase, me } = await requireUser();
  const profiles = await getProfiles(supabase);
  const { data: proj } = await supabase.from("tasks").select("project").neq("project", "");
  const projects = [...new Set((proj ?? []).map((p) => p.project as string))].sort((a, b) => a.localeCompare(b, "es"));
  return (
    <>
      <Header me={me} />
      <main className="page narrow">
        <div className="crumbs"><Link href="/">← Tareas</Link></div>
        <h1 style={{ fontSize: 28 }}>Nueva tarea</h1>
        <TaskForm mode="crear" action={createTask} people={Object.values(profiles)} meId={me.id} projects={projects} />
      </main>
    </>
  );
}
