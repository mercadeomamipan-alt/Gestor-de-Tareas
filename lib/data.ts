import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Task, TaskListItem } from "@/lib/types";
import { PERSON_HUES } from "@/lib/people";

/** Persona con sesión iniciada y su perfil. Redirige a /login si no hay sesión. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profiles = await getProfiles(supabase);
  const me: Profile = profiles[user.id] ?? { id: user.id, email: user.email ?? "", full_name: user.email ?? "" };
  return { supabase, me };
}

export type Supa = Awaited<ReturnType<typeof createClient>>;

export async function getProfiles(supabase: Supa): Promise<Record<string, Profile>> {
  const { data } = await supabase.from("profiles").select("id, email, full_name, created_at").order("created_at").order("id");
  // Cada persona recibe un color distinto según su orden de llegada al equipo
  return Object.fromEntries(
    (data ?? []).map(({ created_at: _c, ...p }, i) => [p.id, { ...p, hue: PERSON_HUES[i % PERSON_HUES.length] } as Profile]),
  );
}

type Row = Task & {
  task_assignees: { user_id: string }[];
  requirements: { done: boolean }[];
  task_notes: { id: string }[];
};

export async function listTasks(supabase: Supa): Promise<TaskListItem[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, task_assignees(user_id), requirements(done), task_notes(id)")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error("No se pudieron cargar las tareas: " + error.message);
  return ((data ?? []) as Row[]).map(({ task_assignees, requirements, task_notes, ...t }) => ({
    ...t,
    assignees: task_assignees.map((a) => a.user_id),
    req_total: requirements.length,
    req_done: requirements.filter((r) => r.done).length,
    note_count: task_notes.length,
  }));
}

/** Última lectura de cada tarea por esta persona. */
export async function getReads(supabase: Supa, userId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from("task_reads").select("task_id, last_read_at").eq("user_id", userId);
  return Object.fromEntries((data ?? []).map((r) => [r.task_id, r.last_read_at]));
}

/** Notas recientes de otras personas (últimos 30 días), para detectar "notas nuevas". */
export async function getRecentNotesByOthers(supabase: Supa, userId: string) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabase
    .from("task_notes")
    .select("task_id, author_id, created_at")
    .neq("author_id", userId)
    .gte("created_at", since);
  return data ?? [];
}

export { displayName, initials } from "@/lib/people";
