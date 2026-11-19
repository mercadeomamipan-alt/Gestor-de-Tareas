import Link from "next/link";
import { Header } from "@/components/Header";
import { EventForm } from "@/components/EventForm";
import { requireUser, getProfiles } from "@/lib/data";
import { isValidISO } from "@/lib/dates";
import { createEvent } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEventPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, me } = await requireUser();
  const profiles = await getProfiles(supabase);
  // Crear un evento desde una tarea: se vincula y se prellenan los participantes
  let taskTitle: string | undefined;
  let participants: string[] | undefined;
  if (sp.tarea) {
    const { data } = await supabase.from("tasks").select("title, task_assignees(user_id)").eq("id", sp.tarea).maybeSingle();
    if (data) {
      taskTitle = data.title as string;
      participants = [...new Set([me.id, ...(data.task_assignees as { user_id: string }[]).map((a) => a.user_id)])];
    }
  }
  return (
    <>
      <Header me={me} />
      <main className="page narrow">
        <div className="crumbs"><Link href="/eventos">← Eventos</Link></div>
        <h1 style={{ fontSize: 28 }}>Nuevo evento</h1>
        <EventForm
          mode="crear"
          action={createEvent}
          people={Object.values(profiles)}
          meId={me.id}
          defaults={{ date: isValidISO(sp.fecha) ? sp.fecha : undefined, taskId: taskTitle ? sp.tarea : undefined, taskTitle, participants }}
        />
      </main>
    </>
  );
}
