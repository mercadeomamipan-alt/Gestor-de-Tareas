import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, nextWorkday, todayISO } from "@/lib/dates";
import type { CalEvent, EventListItem } from "@/lib/types";

type Row = CalEvent & { event_participants: { user_id: string }[]; tasks: { id: string }[] };

const toItem = ({ event_participants, tasks, ...e }: Row): EventListItem => ({
  ...e,
  participants: event_participants.map((p) => p.user_id),
  task_count: tasks.length,
});

/** Eventos entre dos fechas (incluidas), ordenados por fecha y hora. Sin fechas: todos. */
export async function listEvents(supabase: SupabaseClient, from?: string, to?: string): Promise<EventListItem[]> {
  let q = supabase.from("events").select("*, event_participants(user_id), tasks(id)");
  if (from) q = q.gte("event_date", from);
  if (to) q = q.lte("event_date", to);
  const { data, error } = await q.order("event_date").order("start_time", { ascending: true, nullsFirst: true });
  if (error) {
    // Si la tabla aún no existe (falta correr la actualización SQL), la app sigue funcionando sin eventos
    console.error("[eventos]", error.message);
    return [];
  }
  return ((data ?? []) as Row[]).map(toItem);
}

export async function getEvent(supabase: SupabaseClient, id: string): Promise<EventListItem | null> {
  const { data } = await supabase.from("events").select("*, event_participants(user_id), tasks(id)").eq("id", id).maybeSingle();
  return data ? toItem(data as Row) : null;
}

function nextDate(e: CalEvent): string {
  if (e.recurrence === "diaria") return nextWorkday(e.event_date);
  if (e.recurrence === "semanal") return addDays(e.event_date, 7);
  return addMonths(e.event_date, 1);
}

/**
 * Eventos que se repiten: siempre existe la próxima ocurrencia. Cuando llega la fecha de la última,
 * se crea la siguiente (diaria: el siguiente día de lunes a sábado; semanal; mensual).
 * Cada ocurrencia tiene sus propias notas y tareas. Un índice único evita duplicados.
 */
export async function ensureEventRecurrences(supabase: SupabaseClient, today = todayISO()) {
  const { data, error } = await supabase
    .from("events")
    .select("*, event_participants(user_id), tasks(id)")
    .neq("recurrence", "ninguna");
  if (error || !data?.length) return { created: 0 };
  const { data: children } = await supabase.from("events").select("recurrence_from").not("recurrence_from", "is", null);
  const hasChild = new Set((children ?? []).map((c) => c.recurrence_from as string));

  let created = 0;
  for (const leaf of (data as Row[]).filter((e) => !hasChild.has(e.id))) {
    let current: Row = leaf;
    for (let guard = 0; guard < 8 && current.event_date <= today; guard++) {
      const { data: next, error: insErr } = await supabase
        .from("events")
        .insert({
          title: current.title,
          kind: current.kind,
          event_date: nextDate(current),
          start_time: current.start_time,
          end_time: current.end_time,
          location: current.location,
          description: current.description,
          recurrence: current.recurrence,
          recurrence_from: current.id,
          created_by: current.created_by,
        })
        .select("*")
        .single();
      if (insErr || !next) break;
      const people = current.event_participants.map((p) => p.user_id);
      if (people.length) {
        await supabase.from("event_participants").insert(people.map((u) => ({ event_id: next.id, user_id: u })));
      }
      created++;
      current = { ...(next as CalEvent), event_participants: current.event_participants, tasks: [] };
    }
  }
  return { created };
}
